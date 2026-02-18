import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function generateInvoiceHTML(order, companySettings) {
  const invoiceDate = format(new Date(), 'dd.MM.yyyy');
  const dueDate = format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'dd.MM.yyyy');
  
  const tvaRate = companySettings?.tva_rate || 19;
  const subtotal = order.total_price || 0;
  const subtotalFaraTVA = subtotal / (1 + tvaRate / 100);
  const tvaAmount = subtotal - subtotalFaraTVA;
  
  let orderRows = '';
  
  if (order.order_items && order.order_items.length > 0) {
    let rowNum = 1;
    order.order_items.forEach(item => {
      const sizesText = Object.entries(item.sizes_breakdown || {}).map(([s, q]) => `${s}:${q}`).join(', ');
      orderRows += `
        <tr>
          <td>${rowNum}</td>
          <td>${item.product_name} - ${item.color}<br/><small style="color: #6b7280;">Mărimi: ${sizesText}</small></td>
          <td>${order.personalization_type || '-'}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${((item.base_product_cost || 0) + (item.personalization_cost_per_unit || 0)).toFixed(2)}</td>
          <td class="right">${(item.quantity * ((item.base_product_cost || 0) + (item.personalization_cost_per_unit || 0))).toFixed(2)}</td>
        </tr>
      `;
      if (item.setup_fee > 0) {
        rowNum++;
        orderRows += `
          <tr>
            <td>${rowNum}</td>
            <td>Setup ${item.product_name}</td>
            <td>-</td>
            <td class="right">1</td>
            <td class="right">${item.setup_fee.toFixed(2)}</td>
            <td class="right">${item.setup_fee.toFixed(2)}</td>
          </tr>
        `;
      }
      rowNum++;
    });
  } else {
    const unitPrice = (order.base_product_cost || 0) + (order.personalization_cost_per_unit || 0);
    orderRows = `
      <tr>
        <td>1</td>
        <td>${order.product_name}${order.color ? ' - ' + order.color : ''}</td>
        <td>${order.personalization_type || '-'}</td>
        <td class="right">${order.quantity}</td>
        <td class="right">${unitPrice.toFixed(2)}</td>
        <td class="right">${(order.quantity * unitPrice).toFixed(2)}</td>
      </tr>
    `;
    if (order.setup_fee > 0) {
      orderRows += `
        <tr>
          <td>2</td>
          <td>Taxă setup/pregătire</td>
          <td>-</td>
          <td class="right">1</td>
          <td class="right">${order.setup_fee.toFixed(2)}</td>
          <td class="right">${order.setup_fee.toFixed(2)}</td>
        </tr>
      `;
    }
  }
  
  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Factură</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f6f7f9;
      margin: 0;
      padding: 40px;
      color: #1f2937;
    }

    .invoice-container {
      max-width: 900px;
      margin: auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
    }

    .company-info h1 {
      margin: 0;
      font-size: 26px;
    }

    .company-info p {
      margin: 4px 0;
      font-size: 14px;
      color: #4b5563;
    }

    .invoice-meta {
      text-align: right;
    }

    .invoice-meta h2 {
      margin: 0;
      font-size: 22px;
    }

    .invoice-meta p {
      margin: 4px 0;
      font-size: 14px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th, td {
      padding: 12px 10px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }

    th {
      background: #f3f4f6;
      text-align: left;
      font-weight: bold;
    }

    td.right, th.right {
      text-align: right;
    }

    tr:nth-child(even) td {
      background: #fafafa;
    }

    .totals {
      width: 100%;
      max-width: 400px;
      margin-left: auto;
    }

    .totals table {
      width: 100%;
    }

    .totals td {
      padding: 8px 10px;
      font-size: 14px;
    }

    .totals .label {
      text-align: left;
      color: #4b5563;
    }

    .totals .value {
      text-align: right;
    }

    .totals .grand-total {
      font-size: 18px;
      font-weight: bold;
      background: #eef2ff;
    }

    .payment-box {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      font-size: 14px;
    }

    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }

    .footer strong {
      color: #111827;
    }
  </style>
</head>
<body>

<div class="invoice-container">

  <!-- HEADER -->
  <div class="header">
    <div class="company-info">
      <h1>${companySettings?.company_name || 'PrintFlow'}</h1>
      <p>${companySettings?.company_address || ''}</p>
      <p>CUI: ${companySettings?.cui || '-'}</p>
      <p>Telefon: ${companySettings?.company_phone || '-'}</p>
      <p>Email: ${companySettings?.company_email || '-'}</p>
    </div>

    <div class="invoice-meta">
      <h2>FACTURĂ</h2>
      <p>Nr: <strong>${order.order_number || order.id.slice(-6)}</strong></p>
      <p>Data: ${invoiceDate}</p>
      <p>Scadență: ${dueDate}</p>
    </div>
  </div>

  <!-- CLIENT -->
  <div class="section">
    <div class="section-title">Facturat către</div>
    <p><strong>${order.client_name}</strong></p>
    <p>${order.delivery_address || '-'}</p>
    <p>Email: ${order.client_email}</p>
    <p>Telefon: ${order.client_phone || '-'}</p>
  </div>

  <!-- ORDER TABLE -->
  <div class="section">
    <div class="section-title">Detalii comandă</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Produs / Serviciu</th>
          <th>Personalizare</th>
          <th class="right">Cantitate</th>
          <th class="right">Preț unitar (RON)</th>
          <th class="right">Subtotal (RON)</th>
        </tr>
      </thead>
      <tbody>
        ${orderRows}
      </tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="section totals">
    <table>
      <tr>
        <td class="label">Subtotal</td>
        <td class="value">${subtotalFaraTVA.toFixed(2)} RON</td>
      </tr>
      <tr>
        <td class="label">TVA (${tvaRate}%)</td>
        <td class="value">${tvaAmount.toFixed(2)} RON</td>
      </tr>
      <tr>
        <td class="label">Transport</td>
        <td class="value">0.00 RON</td>
      </tr>
      <tr class="grand-total">
        <td>Total de plată</td>
        <td class="value">${subtotal.toFixed(2)} RON</td>
      </tr>
    </table>
  </div>

  <!-- PAYMENT -->
  <div class="section">
    <div class="section-title">Detalii plată</div>
    <div class="payment-box">
      <p>Banca: <strong>${companySettings?.bank_name || '-'}</strong></p>
      <p>IBAN: <strong>${companySettings?.bank_iban || '-'}</strong></p>
      <p>Mențiune plată: <strong>${order.order_number || order.id.slice(-6)}</strong></p>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>Vă mulțumim pentru colaborare!</p>
    <p><strong>${companySettings?.company_name || 'PrintFlow'}</strong> · ${companySettings?.company_website || ''}</p>
  </div>

</div>

</body>
</html>`;

  return html;
}

export async function downloadInvoiceHTML(order, companySettings) {
  const html = generateInvoiceHTML(order, companySettings);
  
  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  
  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get the invoice container
  const invoiceEl = container.querySelector('.invoice-container');
  
  if (!invoiceEl) {
    document.body.removeChild(container);
    return;
  }
  
  // Use html2canvas to render to image
  const canvas = await html2canvas(invoiceEl, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });
  
  document.body.removeChild(container);
  
  // Convert to PDF
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const imgX = (pdfWidth - imgWidth * ratio) / 2;
  const imgY = 10;
  
  pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
  pdf.save(`factura_${order.order_number || order.id.slice(-6)}.pdf`);
}