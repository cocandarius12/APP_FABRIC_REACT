import { base44 } from '@base44/js-sdk';

/**
 * Admin API: Get audit history for an order
 * GET /admin/order/:id/history
 */
export default async function getOrderHistory(request) {
  const { id } = request.params;

  if (!id) {
    return {
      statusCode: 400,
      body: { error: 'Missing order ID' }
    };
  }

  try {
    // Check if user is admin
    const currentUser = await base44.auth.me();
    if (currentUser?.role !== 'admin') {
      return {
        statusCode: 403,
        body: { error: 'Admin access required' }
      };
    }

    // Fetch all audit logs for this order
    const auditLogs = await base44.asServiceRole.entities.AuditLog.filter(
      { order_id: id },
      '-created_date', // Sort by most recent first
      100 // Limit to last 100 events
    );

    return {
      statusCode: 200,
      body: {
        order_id: id,
        events: auditLogs,
        count: auditLogs.length
      }
    };
  } catch (error) {
    console.error('[GET HISTORY ERROR]', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to retrieve audit history', details: String(error) }
    };
  }
}