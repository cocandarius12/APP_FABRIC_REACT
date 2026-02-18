import { base44 } from '@base44/js-sdk';
import { buildOrderStateFromConversation, parseMessageAndUpdateState } from '../components/utils/chatParser';

/**
 * Edit a message in an order's conversation history with atomic reprocessing
 * 
 * POST { orderId, messageId, newText, userId }
 * 
 * Returns: { ok: true, orderState } on success
 *          { error: string, diagnostics? } on failure
 */
export default async function editMessage(request) {
  const { orderId, messageId, newText, userId } = request.body;

  if (!orderId || !messageId || !newText || !userId) {
    return {
      statusCode: 400,
      body: { error: 'Missing required fields: orderId, messageId, newText, userId' }
    };
  }

  const appendAudit = async (event, details = {}) => {
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        order_id: orderId,
        event,
        user_id: userId,
        message_id: messageId,
        timestamp: Date.now(),
        ...details
      });
    } catch (err) {
      console.error('[AUDIT ERROR]', err);
    }
  };

  let order = null;

  try {
    // 1) LOAD ORDER
    order = await base44.asServiceRole.entities.Order.read(orderId);
    if (!order) {
      return { statusCode: 404, body: { error: 'Order not found' } };
    }

    // 2) AUTHORIZATION CHECK
    const currentUser = await base44.auth.me();
    const isOwner = order.client_email === userId || order.created_by === userId;
    const isAdmin = currentUser?.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      await appendAudit('edit_attempt', { error: 'unauthorized', new_text: newText });
      return { statusCode: 403, body: { error: 'Unauthorized: not order owner or admin' } };
    }

    // 3) LOCK ORDER (atomic check-and-set)
    if (order.lockedForEdit) {
      return { statusCode: 409, body: { error: 'order_locked', message: 'Order is currently being edited' } };
    }

    await base44.asServiceRole.entities.Order.update(orderId, { lockedForEdit: true });
    console.log('[EDIT] Order locked:', orderId);

    try {
      // 4) FIND MESSAGE INDEX
      const aiConversation = order.aiConversation || [];
      const idx = aiConversation.findIndex((msg, i) => 
        msg.id === messageId || i.toString() === messageId
      );
      
      if (idx === -1) {
        await appendAudit('edit_attempt', { error: 'message_not_found', new_text: newText });
        return { statusCode: 404, body: { error: 'Message not found in conversation' } };
      }

      const oldMessage = aiConversation[idx];
      const oldText = oldMessage.content;

      // 5) RECORD AUDIT ATTEMPT
      await appendAudit('edit_attempt', { old_text: oldText, new_text: newText });

      // 6) CREATE MODIFIED CONVERSATION
      const modifiedConversation = JSON.parse(JSON.stringify(aiConversation));
      modifiedConversation[idx] = {
        ...oldMessage,
        content: newText,
        editedAt: Date.now(),
        editedBy: userId,
        originalContent: oldText
      };

      console.log('[EDIT] Replaying from index:', idx, 'to:', modifiedConversation.length - 1);

      // 7) REPROCESS: Build state from messages before edit
      let tempOrderState;
      try {
        tempOrderState = buildOrderStateFromConversation(modifiedConversation.slice(0, idx));
        console.log('[EDIT] Base state built from', idx, 'messages');
      } catch (err) {
        const diagnostics = {
          error: 'Failed to build base order state',
          details: String(err),
          stage: 'buildOrderStateFromConversation',
          messageIndex: idx
        };
        await appendAudit('edit_failed', { error: String(err), diagnostics });
        return { statusCode: 400, body: { error: 'reparse_failed', diagnostics } };
      }

      // 8) REPLAY MESSAGES FROM idx TO END
      const replayLogs = [];
      for (let i = idx; i < modifiedConversation.length; i++) {
        const msg = modifiedConversation[i];
        if (msg.role === 'user') {
          try {
            const before = JSON.parse(JSON.stringify(tempOrderState));
            const result = parseMessageAndUpdateState(tempOrderState, msg.content);
            Object.assign(tempOrderState, result);
            
            // Log detailed diagnostics
            const logEntry = {
              messageId: msg.id || i,
              idx: i,
              lastQuestion: before.lastQuestion,
              activeVariantBefore: before.activeVariant,
              activeVariantAfter: tempOrderState.activeVariant,
              targetVariant: result._diagnostics?.targetVariant,
              parsedSizesDetected: result._diagnostics?.parsedSizes || [],
              parsedColorsDetected: result._diagnostics?.parsedColors || [],
              mergedQuantitiesBefore: before.variants.map(v => ({ 
                color: v.color, 
                quantities: v.quantities_per_size, 
                assigned: Object.values(v.quantities_per_size).reduce((s, q) => s + q, 0)
              })),
              mergedQuantitiesAfter: tempOrderState.variants.map(v => ({ 
                color: v.color, 
                quantities: v.quantities_per_size, 
                assigned: Object.values(v.quantities_per_size).reduce((s, q) => s + q, 0),
                total_quantity: v.total_quantity,
                isComplete: v.isComplete,
                error: v.error
              }))
            };
            replayLogs.push(logEntry);
            console.log('[REPLAY]', i, logEntry);
          } catch (err) {
            const diagnostics = {
              error: 'Reparse failed during replay',
              details: String(err),
              stack: err.stack,
              failedAt: i,
              failedMessage: msg.content,
              replayLogs
            };
            console.error('[EDIT FAILED]', diagnostics);
            await appendAudit('edit_failed', { error: String(err), diagnostics });
            return { statusCode: 400, body: { error: 'reparse_failed', diagnostics } };
          }
        } else if (msg.role === 'assistant') {
          tempOrderState.lastQuestion = msg.content;
        }
      }

      // 9) PERSIST ATOMICALLY
      await base44.asServiceRole.entities.Order.update(orderId, {
        aiConversation: modifiedConversation,
        orderState: tempOrderState,
        lockedForEdit: false
      });

      // 10) RECORD SUCCESS
      await appendAudit('edit_success', { 
        reprocessResult: 'success',
        replayLogs
      });

      console.log('[EDIT SUCCESS] Order updated:', orderId);

      return {
        statusCode: 200,
        body: {
          ok: true,
          orderState: tempOrderState,
          replayLogs
        }
      };

    } finally {
      // ALWAYS UNLOCK (in case of unexpected error)
      try {
        await base44.asServiceRole.entities.Order.update(orderId, { lockedForEdit: false });
        console.log('[EDIT] Order unlocked:', orderId);
      } catch (unlockErr) {
        console.error('[CRITICAL] Failed to unlock order:', orderId, unlockErr);
      }
    }

  } catch (error) {
    console.error('[EDIT ERROR]', error);
    
    // Attempt to unlock if we have the order
    if (order) {
      try {
        await base44.asServiceRole.entities.Order.update(orderId, { lockedForEdit: false });
      } catch (unlockErr) {
        console.error('[CRITICAL] Failed to unlock order after error:', orderId, unlockErr);
      }
    }

    await appendAudit('edit_failed', { 
      error: String(error),
      diagnostics: { stack: error.stack }
    });

    return {
      statusCode: 500,
      body: { error: 'Internal server error', details: String(error) }
    };
  }
}