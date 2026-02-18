import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

export async function generateInvoicePDF(order, companySettings) {
  const doc = new jsPDF();
  const pageWidth = 210;
  const margin = 15;
  let yPos = 15;
  
  // Header Background
  doc.setFillColor(51, 65, 85);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('FACTURĂ', margin, 20);
  
  yPos = 25;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(companySettings?.company_name || 'PrintFlow', pageWidth - margin, yPos, { align: 'right' });
  
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  if (companySettings?.company_address) {
    doc.text(companySettings.company_address, 200, yPos, { align: 'right' });
    yPos += 5;
  }
  if (companySettings?.cui) {
    doc.text(`CUI: ${companySettings.cui}`, 200, yPos, { align: 'right' });
    yPos += 5;
  }
  if (companySettings?.reg_com) {
    doc.text(`Reg. Com.: ${companySettings.reg_com}`, 200, yPos, { align: 'right' });
    yPos += 5;
  }
  if (companySettings?.company_phone) {
    doc.text(`Tel: ${companySettings.company_phone}`, 200, yPos, { align: 'right' });
    yPos += 5;
  }
  if (companySettings?.company_email) {
    doc.text(`Email: ${companySettings.company_email}`, 200, yPos, { align: 'right' });
    yPos += 5;
  }
  
  // Invoice Details Box
  yPos = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, yPos, 90, 25, 3, 3, 'F');
  
  yPos += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(`Factură Nr: ${order.order_number || order.id.slice(-6)}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`Data: ${format(new Date(), 'dd.MM.yyyy', { locale: ro })}`, 15, yPos);
  yPos += 6;
  doc.text(`Scadență: ${format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'dd.MM.yyyy', { locale: ro })}`, 15, yPos);
  
  // Client Info
  yPos += 12;
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT:', 15, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(order.client_name || '-', 15, yPos);
  yPos += 5;
  if (order.client_company) {
    doc.text(order.client_company, 15, yPos);
    yPos += 5;
  }
  doc.text(order.client_email || '-', 15, yPos);
  yPos += 5;
  doc.text(order.client_phone || '-', 15, yPos);
  yPos += 5;
  if (order.delivery_address) {
    doc.text(order.delivery_address, 15, yPos);
    yPos += 5;
  }
  
  // Order Details Table
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos, 180, 8, 'F');
  
  doc.text('Nr.', 18, yPos + 5);
  doc.text('Produs/Serviciu', 30, yPos + 5);
  doc.text('Cant.', 110, yPos + 5);
  doc.text('Preț/buc', 135, yPos + 5);
  doc.text('Total', 170, yPos + 5, { align: 'right' });
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  
  // Product lines
  if (order.order_items && order.order_items.length > 0) {
    let lineNum = 1;
    order.order_items.forEach(item => {
      // Product line
      doc.text(`${lineNum}`, 18, yPos);
      const productText = `${item.product_name} - ${item.color}`;
      doc.text(productText, 30, yPos);
      doc.text(`${item.quantity}`, 110, yPos);
      doc.text(`${item.base_product_cost?.toFixed(2) || '0'}`, 135, yPos);
      doc.text(`${(item.base_product_cost * item.quantity).toFixed(2)}`, 190, yPos, { align: 'right' });

      yPos += 6;
      lineNum++;

      // Personalization line
      doc.text(`${lineNum}`, 18, yPos);
      const persText = `Personalizare ${order.personalization_type || ''} - ${item.product_name}`;
      doc.text(persText, 30, yPos);
      doc.text(`${item.quantity}`, 110, yPos);
      doc.text(`${(item.personalization_cost_per_unit || 0).toFixed(2)}`, 135, yPos);
      doc.text(`${((item.personalization_cost_per_unit || 0) * item.quantity).toFixed(2)}`, 190, yPos, { align: 'right' });

      yPos += 6;
      lineNum++;

      // Setup fee per item
      if (item.setup_fee > 0) {
        doc.text(`${lineNum}`, 18, yPos);
        doc.text(`Setup ${item.product_name}`, 30, yPos);
        doc.text('1', 110, yPos);
        doc.text(`${item.setup_fee.toFixed(2)}`, 135, yPos);
        doc.text(`${item.setup_fee.toFixed(2)}`, 190, yPos, { align: 'right' });

        yPos += 6;
        lineNum++;
      }
    });
  } else {
    // Legacy single product format
    doc.text('1', 18, yPos);
    const productText = `${order.product_name}${order.color ? ' - ' + order.color : ''}`;
    doc.text(productText, 30, yPos);
    doc.text(`${order.quantity}`, 110, yPos);

    const baseProductCost = order.unit_price - (order.personalization_cost_per_unit || 0);
    doc.text(`${baseProductCost.toFixed(2)}`, 135, yPos);
    doc.text(`${(baseProductCost * order.quantity).toFixed(2)}`, 190, yPos, { align: 'right' });

    yPos += 6;
    doc.text('2', 18, yPos);
    const persText = `Personalizare ${order.personalization_type || ''} - ${order.personalization_zone || ''}`;
    doc.text(persText, 30, yPos);
    doc.text(`${order.quantity}`, 110, yPos);
    doc.text(`${(order.personalization_cost_per_unit || 0).toFixed(2)}`, 135, yPos);
    doc.text(`${((order.personalization_cost_per_unit || 0) * order.quantity).toFixed(2)}`, 190, yPos, { align: 'right' });

    yPos += 6;
    if (order.setup_fee > 0) {
      doc.text('3', 18, yPos);
      doc.text('Taxă setup/pregătire', 30, yPos);
      doc.text('1', 110, yPos);
      doc.text(`${order.setup_fee.toFixed(2)}`, 135, yPos);
      doc.text(`${order.setup_fee.toFixed(2)}`, 190, yPos, { align: 'right' });
    }
  }
  
  // Totals
  yPos += 10;
  doc.line(15, yPos, 195, yPos);
  
  const subtotal = order.total_price || 0;
  const tvaRate = companySettings?.tva_rate || 19;
  const subtotalFaraTVA = subtotal / (1 + tvaRate / 100);
  const tvaAmount = subtotal - subtotalFaraTVA;
  
  yPos += 6;
  doc.text('Subtotal (fără TVA):', 120, yPos);
  doc.text(`${subtotalFaraTVA.toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  yPos += 6;
  doc.text(`TVA (${tvaRate}%):`, 120, yPos);
  doc.text(`${tvaAmount.toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setFillColor(240, 240, 240);
  doc.rect(115, yPos - 5, 80, 10, 'F');
  doc.text('TOTAL:', 120, yPos);
  doc.text(`${subtotal.toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  // Payment Details
  yPos += 20;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALII PLATĂ:', 15, yPos);
  
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  if (companySettings?.bank_name) {
    doc.text(`Bancă: ${companySettings.bank_name}`, 15, yPos);
    yPos += 5;
  }
  if (companySettings?.bank_iban) {
    doc.text(`IBAN: ${companySettings.bank_iban}`, 15, yPos);
    yPos += 5;
  }
  if (companySettings?.bank_swift) {
    doc.text(`SWIFT/BIC: ${companySettings.bank_swift}`, 15, yPos);
    yPos += 5;
  }
  
  // Footer
  doc.setFontSize(8);
  doc.text(companySettings?.invoice_notes || 'Vă mulțumim pentru comanda dumneavoastră!', 105, 280, { align: 'center' });
  if (companySettings?.company_website) {
    doc.text(companySettings.company_website, 105, 285, { align: 'center' });
  }
  
  const filename = `factura_${order.order_number || order.id.slice(-6)}.pdf`;
  doc.save(filename);
}

export async function generateAtelierOrderPDF(order) {
  const doc = new jsPDF();
  let yPos = 20;
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SUMAR COMANDĂ ATELIER', 105, yPos, { align: 'center' });
  
  yPos += 15;
  doc.setFontSize(12);
  doc.text(`Comandă: ${order.order_number || order.id.slice(-6)}`, 15, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${format(new Date(order.created_date), 'dd.MM.yyyy HH:mm', { locale: ro })}`, 15, yPos);
  
  yPos += 6;
  doc.text(`Termen livrare: ${order.estimated_lead_time_days} zile`, 15, yPos);
  
  // Client Info
  yPos += 12;
  doc.setFont('helvetica', 'bold');
  doc.text('DETALII CLIENT:', 15, yPos);
  
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Nume: ${order.client_name}`, 15, yPos);
  yPos += 5;
  doc.text(`Email: ${order.client_email}`, 15, yPos);
  yPos += 5;
  doc.text(`Telefon: ${order.client_phone || '-'}`, 15, yPos);
  yPos += 5;
  if (order.delivery_address) {
    const lines = doc.splitTextToSize(`Adresă: ${order.delivery_address}`, 180);
    doc.text(lines, 15, yPos);
    yPos += lines.length * 5;
  }
  
  // Order Details
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.text('DETALII PRODUS:', 18, yPos + 5);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.text(`Produs: ${order.product_name}`, 15, yPos);
  yPos += 6;
  if (order.color) {
    doc.text(`Culoare: ${order.color}`, 15, yPos);
    yPos += 6;
  }
  doc.text(`Cantitate totală: ${order.quantity} bucăți`, 15, yPos);
  
  if (order.sizes_breakdown) {
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Distribuție mărimi:', 15, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    
    Object.entries(order.sizes_breakdown).forEach(([size, qty]) => {
      if (qty > 0) {
        doc.text(`  ${size}: ${qty} buc`, 20, yPos);
        yPos += 5;
      }
    });
  }
  
  // Personalization
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.text('PERSONALIZARE:', 18, yPos + 5);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  doc.text(`Tehnică: ${order.personalization_type || '-'}`, 15, yPos);
  yPos += 6;
  doc.text(`Zonă: ${order.personalization_zone || '-'}`, 15, yPos);
  
  // Cost Breakdown
  yPos += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos, 180, 8, 'F');
  doc.text('DETALII COST:', 18, yPos + 5);
  
  yPos += 10;
  doc.setFont('helvetica', 'normal');
  
  const baseProductCost = order.unit_price - (order.personalization_cost_per_unit || 0);
  doc.text(`Produs de bază (${order.quantity} × ${baseProductCost.toFixed(2)} RON):`, 20, yPos);
  doc.text(`${(baseProductCost * order.quantity).toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  yPos += 6;
  doc.text(`Personalizare (${order.quantity} × ${(order.personalization_cost_per_unit || 0).toFixed(2)} RON):`, 20, yPos);
  doc.text(`${((order.personalization_cost_per_unit || 0) * order.quantity).toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  yPos += 6;
  doc.text('Taxă setup:', 20, yPos);
  doc.text(`${(order.setup_fee || 0).toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 20, yPos);
  doc.text(`${(order.total_price || 0).toFixed(2)} RON`, 190, yPos, { align: 'right' });
  
  // Special Instructions
  if (order.special_instructions) {
    yPos += 12;
    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUCȚIUNI SPECIALE:', 15, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    const instructions = doc.splitTextToSize(order.special_instructions, 180);
    doc.text(instructions, 15, yPos);
  }
  
  // Footer
  doc.setFontSize(8);
  doc.text('Document generat automat - PrintFlow', 105, 285, { align: 'center' });
  
  const filename = `sumar_atelier_${order.order_number || order.id.slice(-6)}.pdf`;
  doc.save(filename);
}

export function generateOrderPDF(order, type = 'invoice') {
  if (type === 'atelier') {
    return generateAtelierOrderPDF(order);
  }
  // For client invoice, we need company settings
  // This is a simplified version without company settings
  return generateAtelierOrderPDF(order);
}