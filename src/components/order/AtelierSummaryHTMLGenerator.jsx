import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function generateAtelierSummaryHTML(order) {
  const orderDate = order.created_date ? format(new Date(order.created_date), 'dd.MM.yyyy HH:mm', { locale: ro }) : '-';
  
  let productRows = '';
  
  if (order.order_items && order.order_items.length > 0) {
    order.order_items.forEach(item => {
      const sizesText = Object.entries(item.sizes_breakdown || {}).map(([s, q]) => `${s}:${q}`).join(', ');
      productRows += `
        <tr>
          <td>${item.product_name} - ${item.color}<br/><small style="color: #6b7280;">Mărimi: ${sizesText}</small></td>
          <td>${order.product_category || '-'}</td>
          <td>${item.quantity}</td>
          <td>${order.personalization_type || '-'}</td>
          <td>${order.personalization_zone || '-'}</td>
        </tr>
      `;
    });
  } else {
    productRows = `
      <tr>
        <td>${order.product_name}${order.color ? ' - ' + order.color : ''}</td>
        <td>${order.category || '-'}</td>
        <td>${order.quantity}</td>
        <td>${order.personalization_type || '-'}</td>
        <td>${order.personalization_zone || '-'}</td>
      </tr>
    `;
  }
  
  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Order Summary – Platform Internal</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #f4f6f8;
      margin: 0;
      padding: 24px;
      color: #1f2937;
    }
    .container {
      max-width: 900px;
      margin: auto;
      background: #ffffff;
      padding: 28px;
      border-radius: 10px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.08);
    }
    h1 {
      font-size: 22px;
      margin-bottom: 4px;
    }
    .subtitle {
      color: #6b7280;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #111827;
      text-transform: uppercase;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
      font-size: 14px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      color: #6b7280;
    }
    .value {
      font-weight: 600;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    th {
      background: #f9fafb;
      font-size: 13px;
      text-transform: uppercase;
      color: #374151;
    }
    .summary-box {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
    }
    .highlight {
      font-size: 16px;
      font-weight: bold;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 12px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
      font-weight: bold;
    }
  </style>
</head>
<body>

<div class="container">
  <h1>Order Summary</h1>
  <div class="subtitle">Internal platform record – not a fiscal document</div>

  <!-- ORDER META -->
  <div class="section">
    <div class="section-title">Order Metadata</div>
    <div class="grid">
      <div><span class="label">Order ID:</span> <span class="value">${order.order_number || order.id.slice(-6)}</span></div>
      <div><span class="label">Order Date:</span> <span class="value">${orderDate}</span></div>
      <div><span class="label">Status:</span> <span class="badge">${order.status}</span></div>
      <div><span class="label">Assigned Atelier:</span> <span class="value">${order.atelier_name || '-'}</span></div>
    </div>
  </div>

  <!-- CLIENT INFO -->
  <div class="section">
    <div class="section-title">Client Information</div>
    <div class="grid">
      <div><span class="label">Client Name:</span> <span class="value">${order.client_name}</span></div>
      <div><span class="label">Company:</span> <span class="value">${order.client_company || '-'}</span></div>
      <div><span class="label">Email:</span> <span class="value">${order.client_email}</span></div>
      <div><span class="label">Phone:</span> <span class="value">${order.client_phone || '-'}</span></div>
    </div>
    <div style="margin-top: 12px;">
      <span class="label">Delivery Address:</span><br/>
      <span class="value">${order.delivery_address || '-'}</span>
    </div>
  </div>

  <!-- PRODUCT DETAILS -->
  <div class="section">
    <div class="section-title">Order Details</div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>Quantity</th>
          <th>Personalization</th>
          <th>Zone</th>
        </tr>
      </thead>
      <tbody>
        ${productRows}
      </tbody>
    </table>
  </div>

  <!-- FINANCIAL SUMMARY -->
  <div class="section">
    <div class="section-title">Financial Summary (Internal)</div>
    <div class="summary-box">
      <div class="row"><span class="label">Client Price (Total):</span><span class="value">${order.total_price?.toFixed(2) || '0.00'} RON</span></div>
      <div class="row"><span class="label">Lead Time:</span><span class="value">${order.estimated_lead_time_days || '-'} zile</span></div>
    </div>
  </div>

  <!-- LOGISTICS -->
  <div class="section">
    <div class="section-title">Delivery & SLA</div>
    <div class="grid">
      <div><span class="label">Estimated Lead Time:</span> <span class="value">${order.estimated_lead_time_days || '-'} days</span></div>
      <div><span class="label">Tracking:</span> <span class="value">${order.tracking_number || 'Pending'}</span></div>
    </div>
  </div>

</div>

</body>
</html>`;

  return html;
}

export async function downloadAtelierSummaryHTML(order) {
  const html = generateAtelierSummaryHTML(order);
  
  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);
  
  // Wait for render
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get the summary container
  const summaryEl = container.querySelector('.container');
  
  if (!summaryEl) {
    document.body.removeChild(container);
    return;
  }
  
  // Use html2canvas to render to image
  const canvas = await html2canvas(summaryEl, {
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
  pdf.save(`sumar_atelier_${order.order_number || order.id.slice(-6)}.pdf`);
}