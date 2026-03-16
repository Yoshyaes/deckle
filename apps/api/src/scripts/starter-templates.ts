/**
 * Pre-built starter templates that ship with DocuForge.
 * Users can clone these to their own account from the dashboard.
 */

export interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
  category: 'business' | 'finance' | 'legal' | 'marketing';
  htmlContent: string;
  sampleData: Record<string, unknown>;
}

export const starterTemplates: StarterTemplate[] = [
  {
    slug: 'invoice',
    name: 'Professional Invoice',
    description: 'Clean, modern invoice with line items, discounts, tax calculations, and payment terms.',
    category: 'finance',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .company-name { font-size: 24px; font-weight: 700; color: #f97316; }
  .company-details { font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
  .invoice-title { font-size: 32px; font-weight: 700; color: #1a1a2e; text-align: right; }
  .invoice-meta { font-size: 11px; color: #6b7280; text-align: right; margin-top: 8px; line-height: 1.8; }
  .invoice-meta strong { color: #1a1a2e; }
  .status-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
  .status-paid { background: #ecfdf5; color: #059669; }
  .status-pending { background: #fffbeb; color: #d97706; }
  .status-overdue { background: #fef2f2; color: #dc2626; }
  .bill-to { margin-bottom: 30px; }
  .bill-to .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
  .bill-to .name { font-size: 15px; font-weight: 600; }
  .bill-to .details { font-size: 11px; color: #6b7280; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead { display: table-header-group; }
  thead th { background: #f8fafc; padding: 10px 16px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; text-align: left; border-bottom: 2px solid #e5e7eb; }
  thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
  tbody td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
  tbody td:last-child, tbody td:nth-child(3), tbody td:nth-child(4) { text-align: right; }
  tr { page-break-inside: avoid; }
  .item-name { font-weight: 500; }
  .item-desc { font-size: 11px; color: #9ca3af; margin-top: 2px; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-table { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #6b7280; }
  .totals-row.discount { color: #059669; }
  .totals-row.total { border-top: 2px solid #1a1a2e; padding-top: 10px; margin-top: 4px; font-size: 16px; font-weight: 700; color: #1a1a2e; }
  .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #f3f4f6; page-break-inside: avoid; }
  .payment-info { font-size: 11px; color: #6b7280; line-height: 1.8; }
  .payment-info strong { color: #1a1a2e; }
  .notes { margin-top: 16px; font-size: 11px; color: #9ca3af; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">{{company_name}}</div>
      <div class="company-details">
        {{company_address}}<br>
        {{company_email}} &middot; {{company_phone}}
      </div>
    </div>
    <div>
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-meta">
        <strong>Invoice #:</strong> {{invoice_number}}<br>
        <strong>Date:</strong> {{invoice_date}}<br>
        <strong>Due Date:</strong> {{due_date}}
      </div>
      {{#if status}}
      <div class="status-badge status-{{status}}">{{status}}</div>
      {{/if}}
    </div>
  </div>

  <div class="bill-to">
    <div class="label">Bill To</div>
    <div class="name">{{client_name}}</div>
    <div class="details">{{client_address}}<br>{{client_email}}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td class="item-name">{{name}}</td>
        <td style="color: #6b7280; font-size: 12px;">{{description}}</td>
        <td>{{quantity}}</td>
        <td>\${{rate}}</td>
        <td><strong>\${{amount}}</strong></td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-table">
      <div class="totals-row"><span>Subtotal</span><span>\${{subtotal}}</span></div>
      {{#if discount}}
      <div class="totals-row discount"><span>Discount ({{discount_label}})</span><span>-\${{discount}}</span></div>
      {{/if}}
      <div class="totals-row"><span>Tax ({{tax_rate}}%)</span><span>\${{tax_amount}}</span></div>
      <div class="totals-row total"><span>Total</span><span>\${{total}}</span></div>
    </div>
  </div>

  <div class="footer">
    <div class="payment-info">
      <strong>Payment Terms:</strong> {{payment_terms}}<br>
      <strong>Bank:</strong> {{bank_name}} &middot; Account: {{account_number}}
    </div>
    {{#if notes}}
    <div class="notes">{{notes}}</div>
    {{/if}}
  </div>
</body>
</html>`,
    sampleData: {
      company_name: 'Acme Corp',
      company_address: '123 Business Ave, San Francisco, CA 94107',
      company_email: 'billing@acme.com',
      company_phone: '(415) 555-0100',
      invoice_number: 'INV-2026-001',
      invoice_date: 'Feb 25, 2026',
      due_date: 'Mar 25, 2026',
      status: 'pending',
      client_name: 'John Smith',
      client_address: '456 Client St, New York, NY 10001',
      client_email: 'john@example.com',
      items: [
        { name: 'Web Development', description: 'Frontend build — React dashboard', quantity: 40, rate: '150.00', amount: '6,000.00' },
        { name: 'API Integration', description: 'REST API endpoints and auth', quantity: 20, rate: '150.00', amount: '3,000.00' },
        { name: 'Hosting Setup', description: 'AWS infrastructure configuration', quantity: 5, rate: '200.00', amount: '1,000.00' },
      ],
      subtotal: '10,000.00',
      discount: '500.00',
      discount_label: '5% early payment',
      tax_rate: '8.5',
      tax_amount: '807.50',
      total: '10,307.50',
      payment_terms: 'Net 30',
      bank_name: 'First National Bank',
      account_number: '****4521',
      notes: 'Thank you for your business! A 5% discount has been applied for early payment.',
    },
  },
  {
    slug: 'receipt',
    name: 'Payment Receipt',
    description: 'Simple receipt confirming payment with transaction details.',
    category: 'finance',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; max-width: 500px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f3f4f6; }
  .company { font-size: 20px; font-weight: 700; color: #f97316; }
  .title { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; margin-top: 8px; font-weight: 600; }
  .status-badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 20px; margin-top: 16px; }
  .status-success { background: #ecfdf5; color: #059669; }
  .status-pending { background: #fffbeb; color: #d97706; }
  .status-refunded { background: #f3f4f6; color: #6b7280; }
  .status-failed { background: #fef2f2; color: #dc2626; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 10px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; }
  .row .label { color: #6b7280; }
  .row .value { font-weight: 500; }
  .divider { border-top: 1px solid #f3f4f6; margin: 16px 0; }
  .total-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 20px; font-weight: 700; }
  .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #9ca3af; line-height: 1.8; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">{{company_name}}</div>
    <div class="title">Payment Receipt</div>
    <div class="status-badge status-{{status}}">{{status_label}}</div>
  </div>

  <div class="section">
    <div class="section-title">Transaction Details</div>
    <div class="row"><span class="label">Receipt #</span><span class="value">{{receipt_number}}</span></div>
    <div class="row"><span class="label">Date</span><span class="value">{{date}}</span></div>
    <div class="row"><span class="label">Payment Method</span><span class="value">{{payment_method}}</span></div>
    <div class="row"><span class="label">Transaction ID</span><span class="value" style="font-family: monospace; font-size: 11px;">{{transaction_id}}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Customer</div>
    <div class="row"><span class="label">Name</span><span class="value">{{customer_name}}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">{{customer_email}}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    {{#each items}}
    <div class="row">
      <span class="label">{{name}} {{#if quantity}}<span style="color: #9ca3af;">&times;{{quantity}}</span>{{/if}}</span>
      <span class="value">\${{amount}}</span>
    </div>
    {{/each}}
    <div class="divider"></div>
    <div class="total-row">
      <span>Total Paid</span>
      <span style="color: #059669;">\${{total}}</span>
    </div>
  </div>

  <div class="footer">
    {{company_name}}<br>
    {{company_address}}<br>
    {{company_email}}
  </div>
</body>
</html>`,
    sampleData: {
      company_name: 'Acme Corp',
      company_address: '123 Business Ave, San Francisco, CA 94107',
      company_email: 'support@acme.com',
      receipt_number: 'RCP-2026-0042',
      date: 'February 25, 2026',
      status: 'success',
      status_label: 'Payment Successful',
      payment_method: 'Visa ending in 4242',
      transaction_id: 'txn_1Abc2Def3Ghi4Jkl',
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      items: [
        { name: 'Pro Plan (Monthly)', quantity: 1, amount: '49.00' },
        { name: 'Additional API Calls', quantity: 5000, amount: '25.00' },
      ],
      total: '74.00',
    },
  },
  {
    slug: 'report',
    name: 'Business Report',
    description: 'Professional multi-section report with cover page, summary, and data tables.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  @page :not(:first) { margin: 40px 60px; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 10px; color: #9ca3af; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; }
  .cover { min-height: 297mm; display: flex; flex-direction: column; justify-content: center; padding: 60px; background: linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%); color: white; page-break-after: always; }
  .cover-badge { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #f97316; font-weight: 600; margin-bottom: 16px; }
  .cover h1 { font-size: 42px; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }
  .cover .subtitle { font-size: 16px; color: #a5b4c8; margin-bottom: 40px; }
  .cover .meta { font-size: 12px; color: #6b7fa8; line-height: 2; }
  .cover .confidential { margin-top: 60px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #6b7fa8; padding: 8px 16px; border: 1px solid #6b7fa8; display: inline-block; border-radius: 3px; }
  .page { padding: 40px 60px; }
  .page h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #f97316; }
  .page p { font-size: 13px; line-height: 1.8; color: #4b5563; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
  .kpi-card { background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; }
  .kpi-value { font-size: 28px; font-weight: 700; color: #f97316; }
  .kpi-label { font-size: 11px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-change { font-size: 10px; margin-top: 4px; }
  .kpi-change.positive { color: #059669; }
  .kpi-change.negative { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
  thead { display: table-header-group; }
  th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
  tr { page-break-inside: avoid; }
  .highlight { color: #059669; font-weight: 600; }
  .decrease { color: #dc2626; font-weight: 600; }
  .page-footer { text-align: center; font-size: 10px; color: #9ca3af; padding-top: 20px; border-top: 1px solid #f3f4f6; margin-top: 40px; }
</style>
</head>
<body>
  <div class="cover">
    <div class="cover-badge">{{report_type}}</div>
    <h1>{{title}}</h1>
    <div class="subtitle">{{subtitle}}</div>
    <div class="meta">
      Prepared by: {{author}}<br>
      Date: {{date}}<br>
      Period: {{period}}
    </div>
    {{#if confidential}}
    <div class="confidential">Confidential</div>
    {{/if}}
  </div>

  <div class="page">
    <h2>Executive Summary</h2>
    <p>{{summary}}</p>

    <div class="kpi-grid">
      {{#each kpis}}
      <div class="kpi-card">
        <div class="kpi-value">{{value}}</div>
        <div class="kpi-label">{{label}}</div>
        {{#if change}}<div class="kpi-change {{trend}}">{{change}}</div>{{/if}}
      </div>
      {{/each}}
    </div>

    <h2>Detailed Breakdown</h2>
    <table>
      <thead>
        <tr>
          {{#each table_headers}}
          <th>{{this}}</th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each table_rows}}
        <tr>
          {{#each this}}
          <td>{{this}}</td>
          {{/each}}
        </tr>
        {{/each}}
      </tbody>
    </table>

    {{#if recommendations}}
    <h2>Recommendations</h2>
    {{#each recommendations}}
    <p><strong>{{title}}:</strong> {{detail}}</p>
    {{/each}}
    {{/if}}

    <div class="page-footer">
      {{company_name}} &middot; {{report_type}} &middot; {{period}}
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      report_type: 'Quarterly Report',
      title: 'Q1 2026 Performance Review',
      subtitle: 'API usage analytics and growth metrics for the first quarter.',
      author: 'Analytics Team',
      date: 'February 25, 2026',
      period: 'January 1 – March 31, 2026',
      summary: 'Q1 saw significant growth across all key metrics. API call volume increased 42% quarter-over-quarter, with average response times improving by 18%. Customer acquisition accelerated with 156 new accounts, bringing total active customers to 1,247.',
      confidential: true,
      company_name: 'Acme Corp',
      kpis: [
        { value: '1.2M', label: 'API Calls', change: '+42% QoQ', trend: 'positive' },
        { value: '1,247', label: 'Active Users', change: '+14% QoQ', trend: 'positive' },
        { value: '1.8s', label: 'Avg Response', change: '-18% QoQ', trend: 'positive' },
      ],
      table_headers: ['Metric', 'Q4 2025', 'Q1 2026', 'Change'],
      table_rows: [
        ['API Calls', '845,000', '1,200,000', '+42%'],
        ['Active Users', '1,091', '1,247', '+14%'],
        ['Avg Response Time', '2.2s', '1.8s', '-18%'],
        ['Error Rate', '0.8%', '0.5%', '-37%'],
        ['Revenue', '$84,500', '$112,000', '+32%'],
      ],
      recommendations: [
        { title: 'Scale Infrastructure', detail: 'With current growth trajectory, consider adding additional rendering nodes by Q2 to maintain response times under 2s.' },
        { title: 'Template Library', detail: 'The most-used templates should be optimized and cached to reduce redundant rendering.' },
      ],
    },
  },
  {
    slug: 'certificate',
    name: 'Certificate of Completion',
    description: 'Elegant certificate for courses, achievements, and awards.',
    category: 'marketing',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; background: white; }
  .certificate { width: 100%; min-height: 210mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px; position: relative; }
  .border-frame { position: absolute; inset: 20px; border: 3px solid #f97316; border-radius: 4px; }
  .border-frame::before { content: ''; position: absolute; inset: 6px; border: 1px solid #fcd9b6; border-radius: 2px; }
  .org-name { font-size: 14px; text-transform: uppercase; letter-spacing: 4px; color: #f97316; font-weight: 600; margin-bottom: 20px; }
  .cert-title { font-size: 36px; font-weight: 400; color: #1a1a2e; margin-bottom: 8px; letter-spacing: 2px; }
  .cert-subtitle { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #9ca3af; margin-bottom: 40px; }
  .recipient { font-size: 32px; font-weight: 700; color: #1a1a2e; border-bottom: 2px solid #f97316; padding-bottom: 8px; display: inline-block; margin-bottom: 24px; }
  .description { font-size: 14px; color: #6b7280; line-height: 1.8; max-width: 500px; margin: 0 auto 40px; }
  .details { font-size: 12px; color: #9ca3af; margin-bottom: 50px; }
  .signatures { display: flex; justify-content: center; gap: 100px; }
  .sig-block { text-align: center; }
  .sig-line { width: 160px; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 30px; }
  .sig-name { font-size: 13px; font-weight: 600; color: #1a1a2e; }
  .sig-title { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .cert-footer { position: absolute; bottom: 30px; left: 40px; right: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  .cert-id { font-size: 9px; color: #d1d5db; font-family: monospace; }
  .verify-qr { text-align: right; }
  .verify-qr .label { font-size: 8px; color: #d1d5db; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
</style>
</head>
<body>
  <div class="certificate">
    <div class="border-frame"></div>
    <div class="org-name">{{organization}}</div>
    <div class="cert-title">Certificate</div>
    <div class="cert-subtitle">of {{certificate_type}}</div>
    <div style="font-size: 13px; color: #9ca3af; margin-bottom: 12px;">This is proudly presented to</div>
    <div class="recipient">{{recipient_name}}</div>
    <div class="description">{{description}}</div>
    <div class="details">
      Issued on {{issue_date}} &middot; {{location}}
      {{#if expiry_date}}<br>Valid until {{expiry_date}}{{/if}}
    </div>
    <div class="signatures">
      {{#each signers}}
      <div class="sig-block">
        <div class="sig-line">
          <div class="sig-name">{{name}}</div>
          <div class="sig-title">{{title}}</div>
        </div>
      </div>
      {{/each}}
    </div>
    <div class="cert-footer">
      <div class="cert-id">ID: {{certificate_id}}</div>
      {{#if verification_url}}
      <div class="verify-qr">
        <div class="label">Scan to verify</div>
        {{qr:{{verification_url}}}}
      </div>
      {{/if}}
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      organization: 'DocuForge Academy',
      certificate_type: 'Completion',
      recipient_name: 'Alexandra Chen',
      description: 'For successfully completing the Advanced PDF Generation course, demonstrating proficiency in template design, API integration, and automated document workflows.',
      issue_date: 'February 25, 2026',
      expiry_date: 'February 25, 2028',
      location: 'San Francisco, CA',
      certificate_id: 'CERT-2026-00847',
      verification_url: 'https://verify.getdocuforge.dev/CERT-2026-00847',
      signers: [
        { name: 'Sarah Johnson', title: 'Director of Education' },
        { name: 'Michael Park', title: 'Lead Instructor' },
      ],
    },
  },
  {
    slug: 'shipping-label',
    name: 'Shipping Label',
    description: 'Compact shipping label with sender/recipient addresses and tracking info.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: 4in 6in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 0; }
  .label { border: 3px solid #1a1a2e; border-radius: 4px; width: 4in; margin: 0 auto; }
  .label-header { background: #1a1a2e; color: white; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
  .carrier { font-size: 16px; font-weight: 700; }
  .service-type { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; background: #f97316; padding: 3px 8px; border-radius: 3px; font-weight: 600; }
  .addresses { padding: 16px; }
  .address-block { margin-bottom: 16px; }
  .address-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 4px; }
  .address-name { font-size: 14px; font-weight: 700; }
  .address-line { font-size: 12px; color: #4b5563; line-height: 1.6; }
  .divider { border-top: 2px dashed #e5e7eb; margin: 0 16px; }
  .tracking { padding: 16px; text-align: center; background: #f8fafc; }
  .tracking-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
  .tracking-number { font-size: 16px; font-weight: 700; font-family: monospace; letter-spacing: 2px; margin-bottom: 10px; }
  .barcode-container { margin: 0 auto; max-width: 280px; }
  .barcode-container svg { width: 100%; height: auto; }
  .weight-info { padding: 10px 16px; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  .dimensions { font-size: 10px; color: #9ca3af; }
</style>
</head>
<body>
  <div class="label">
    <div class="label-header">
      <span class="carrier">{{carrier}}</span>
      <span class="service-type">{{service_type}}</span>
    </div>
    <div class="addresses">
      <div class="address-block">
        <div class="address-label">From</div>
        <div class="address-name">{{from_name}}</div>
        <div class="address-line">{{from_address}}<br>{{from_city_state_zip}}</div>
      </div>
      <div class="address-block" style="margin-bottom: 0;">
        <div class="address-label">To</div>
        <div class="address-name">{{to_name}}</div>
        <div class="address-line">{{to_address}}<br>{{to_city_state_zip}}</div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="tracking">
      <div class="tracking-label">Tracking Number</div>
      <div class="tracking-number">{{tracking_number}}</div>
      <div class="barcode-container">{{barcode:{{tracking_number}}}}</div>
    </div>
    <div class="weight-info">
      <span>Weight: {{weight}} {{#if dimensions}}<span class="dimensions">&middot; {{dimensions}}</span>{{/if}}</span>
      <span>Ship Date: {{ship_date}}</span>
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      carrier: 'DocuShip',
      service_type: 'Priority',
      from_name: 'Acme Corp',
      from_address: '123 Business Ave',
      from_city_state_zip: 'San Francisco, CA 94107',
      to_name: 'Jane Doe',
      to_address: '456 Oak Street, Apt 2B',
      to_city_state_zip: 'New York, NY 10001',
      tracking_number: '1Z999AA10123456784',
      weight: '2.4 lbs',
      dimensions: '12 × 8 × 6 in',
      ship_date: 'Feb 25, 2026',
    },
  },
  {
    slug: 'resume',
    name: 'Professional Resume',
    description: 'Clean, ATS-friendly resume with sections for experience, education, skills, and contact info.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px 50px; }
  .header { margin-bottom: 24px; border-bottom: 2px solid #f97316; padding-bottom: 16px; }
  .name { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
  .title { font-size: 14px; color: #f97316; font-weight: 600; margin-top: 4px; }
  .contact { display: flex; gap: 16px; margin-top: 10px; font-size: 11px; color: #6b7280; flex-wrap: wrap; }
  .contact span { display: flex; align-items: center; gap: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #f97316; font-weight: 700; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; }
  .entry { margin-bottom: 14px; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-role { font-size: 14px; font-weight: 600; }
  .entry-date { font-size: 11px; color: #9ca3af; }
  .entry-company { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .entry-desc { font-size: 12px; color: #4b5563; line-height: 1.7; margin-top: 6px; }
  .entry-desc li { margin-left: 16px; margin-bottom: 3px; }
  .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .skill-tag { font-size: 11px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 10px; color: #4b5563; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div class="name">{{full_name}}</div>
    <div class="title">{{job_title}}</div>
    <div class="contact">
      <span>{{email}}</span>
      <span>{{phone}}</span>
      <span>{{location}}</span>
      {{#if website}}<span>{{website}}</span>{{/if}}
    </div>
  </div>

  {{#if summary}}
  <div class="section">
    <div class="section-title">Summary</div>
    <div style="font-size: 12px; color: #4b5563; line-height: 1.7;">{{summary}}</div>
  </div>
  {{/if}}

  <div class="section">
    <div class="section-title">Experience</div>
    {{#each experience}}
    <div class="entry">
      <div class="entry-header">
        <div class="entry-role">{{role}}</div>
        <div class="entry-date">{{start_date}} — {{end_date}}</div>
      </div>
      <div class="entry-company">{{company}} · {{location}}</div>
      <ul class="entry-desc">
        {{#each highlights}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
    {{/each}}
  </div>

  <div class="section">
    <div class="section-title">Education</div>
    {{#each education}}
    <div class="entry">
      <div class="entry-header">
        <div class="entry-role">{{degree}}</div>
        <div class="entry-date">{{year}}</div>
      </div>
      <div class="entry-company">{{school}}</div>
    </div>
    {{/each}}
  </div>

  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skills-grid">
      {{#each skills}}
      <div class="skill-tag">{{this}}</div>
      {{/each}}
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      full_name: 'Alex Johnson',
      job_title: 'Senior Full-Stack Developer',
      email: 'alex@example.com',
      phone: '(555) 123-4567',
      location: 'San Francisco, CA',
      website: 'alexjohnson.dev',
      summary: 'Results-driven engineer with 8+ years of experience building scalable web applications. Passionate about developer tools, API design, and creating exceptional user experiences.',
      experience: [
        {
          role: 'Senior Software Engineer',
          company: 'TechCo',
          location: 'San Francisco, CA',
          start_date: 'Jan 2022',
          end_date: 'Present',
          highlights: [
            'Led migration of monolith to microservices, reducing deploy times by 75%',
            'Built real-time PDF generation pipeline processing 500K+ documents/month',
            'Mentored team of 4 junior developers',
          ],
        },
        {
          role: 'Software Engineer',
          company: 'StartupXYZ',
          location: 'Remote',
          start_date: 'Mar 2019',
          end_date: 'Dec 2021',
          highlights: [
            'Designed and implemented REST API serving 10M+ requests/day',
            'Built React dashboard with real-time analytics and data visualization',
          ],
        },
      ],
      education: [
        { degree: 'B.S. Computer Science', school: 'UC Berkeley', year: '2018' },
      ],
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL', 'Redis', 'Go', 'Python'],
    },
  },
  {
    slug: 'contract',
    name: 'Service Agreement',
    description: 'Professional service contract with terms, scope of work, payment details, and signature lines.',
    category: 'legal',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 50px; font-size: 12px; line-height: 1.8; }
  .header { text-align: center; margin-bottom: 40px; }
  .header h1 { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
  .header .subtitle { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; }
  .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
  .party-name { font-size: 14px; font-weight: 600; }
  .party-detail { font-size: 11px; color: #6b7280; line-height: 1.6; }
  .section { margin-bottom: 20px; }
  .section-num { font-size: 13px; font-weight: 700; color: #f97316; margin-bottom: 6px; }
  .section p { color: #4b5563; }
  .scope-item { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .scope-item:last-child { border-bottom: none; }
  .payment-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .payment-table th { background: #f8fafc; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
  .payment-table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 50px; padding-top: 20px; }
  .sig-block { }
  .sig-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 30px; }
  .sig-line { border-bottom: 1px solid #1a1a2e; margin-bottom: 6px; height: 24px; }
  .sig-name { font-weight: 600; font-size: 12px; }
  .sig-date { font-size: 11px; color: #6b7280; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <h1>Service Agreement</h1>
    <div class="subtitle">Contract #{{contract_number}} · Effective {{effective_date}}</div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Service Provider</div>
      <div class="party-name">{{provider_name}}</div>
      <div class="party-detail">{{provider_address}}<br>{{provider_email}}</div>
    </div>
    <div>
      <div class="party-label">Client</div>
      <div class="party-name">{{client_name}}</div>
      <div class="party-detail">{{client_address}}<br>{{client_email}}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-num">1. Scope of Work</div>
    <p>{{scope_intro}}</p>
    {{#each deliverables}}
    <div class="scope-item"><strong>{{title}}:</strong> {{description}}</div>
    {{/each}}
  </div>

  <div class="section">
    <div class="section-num">2. Payment Terms</div>
    <p>Total project value: <strong>\${{total_amount}}</strong>. Payment schedule:</p>
    <table class="payment-table">
      <thead><tr><th>Milestone</th><th>Amount</th><th>Due Date</th></tr></thead>
      <tbody>
        {{#each payments}}
        <tr><td>{{milestone}}</td><td>\${{amount}}</td><td>{{due_date}}</td></tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-num">3. Timeline</div>
    <p>Work shall commence on {{start_date}} and be completed by {{end_date}}. Delays caused by the Client shall extend deadlines accordingly.</p>
  </div>

  <div class="section">
    <div class="section-num">4. Confidentiality</div>
    <p>Both parties agree to keep all project-related information confidential. This obligation survives termination of this agreement for a period of 2 years.</p>
  </div>

  <div class="section">
    <div class="section-num">5. Termination</div>
    <p>Either party may terminate this agreement with {{notice_period}} days written notice. Upon termination, Client shall pay for all work completed to date.</p>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-label">Service Provider</div>
      <div class="sig-line"></div>
      <div class="sig-name">{{provider_signer}}</div>
      <div class="sig-date">Date: _______________</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Client</div>
      <div class="sig-line"></div>
      <div class="sig-name">{{client_signer}}</div>
      <div class="sig-date">Date: _______________</div>
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      contract_number: 'SA-2026-0042',
      effective_date: 'March 1, 2026',
      provider_name: 'Acme Development LLC',
      provider_address: '123 Business Ave, San Francisco, CA 94107',
      provider_email: 'legal@acme.com',
      client_name: 'TechStart Inc.',
      client_address: '456 Innovation Blvd, Austin, TX 78701',
      client_email: 'contracts@techstart.io',
      scope_intro: 'The Service Provider shall deliver the following work:',
      deliverables: [
        { title: 'Web Application', description: 'Full-stack web application with user authentication, dashboard, and API integration.' },
        { title: 'API Development', description: 'RESTful API with comprehensive documentation and SDK support.' },
        { title: 'Deployment', description: 'Production deployment with CI/CD pipeline and monitoring setup.' },
      ],
      total_amount: '45,000',
      payments: [
        { milestone: 'Project Kickoff', amount: '15,000', due_date: 'Mar 1, 2026' },
        { milestone: 'Mid-project Delivery', amount: '15,000', due_date: 'Apr 15, 2026' },
        { milestone: 'Final Delivery', amount: '15,000', due_date: 'May 30, 2026' },
      ],
      start_date: 'March 1, 2026',
      end_date: 'May 30, 2026',
      notice_period: '14',
      provider_signer: 'Sarah Johnson, CEO',
      client_signer: 'Michael Chen, CTO',
    },
  },
  {
    slug: 'proposal',
    name: 'Business Proposal',
    description: 'Professional project proposal with scope, timeline, pricing, and team overview.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; }
  .cover { min-height: 297mm; display: flex; flex-direction: column; justify-content: center; padding: 60px; background: linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%); color: white; page-break-after: always; }
  .cover .badge { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; color: #f97316; font-weight: 600; margin-bottom: 16px; }
  .cover h1 { font-size: 38px; font-weight: 700; line-height: 1.2; margin-bottom: 12px; }
  .cover .for { font-size: 15px; color: #a5b4c8; margin-bottom: 40px; }
  .cover .meta { font-size: 12px; color: #6b7fa8; line-height: 2; }
  .page { padding: 40px 50px; }
  .page h2 { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #f97316; }
  .page p { font-size: 13px; line-height: 1.8; color: #4b5563; margin-bottom: 14px; }
  .scope-card { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 3px solid #f97316; }
  .scope-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .scope-card p { font-size: 12px; color: #6b7280; margin-bottom: 0; }
  .timeline { margin: 20px 0; }
  .timeline-item { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
  .timeline-phase { font-size: 11px; font-weight: 600; color: #f97316; min-width: 80px; }
  .timeline-desc { font-size: 12px; color: #4b5563; }
  .timeline-dates { font-size: 11px; color: #9ca3af; min-width: 120px; text-align: right; }
  .pricing-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .pricing-table th { background: #1a1a2e; color: white; padding: 10px 14px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  .pricing-table td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .pricing-table .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #1a1a2e; }
  .cta { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 24px; border-radius: 8px; text-align: center; margin-top: 30px; }
  .cta h3 { font-size: 18px; margin-bottom: 8px; }
  .cta p { font-size: 13px; opacity: 0.9; margin-bottom: 0; color: white; }
</style>
</head>
<body>
  <div class="cover">
    <div class="badge">Proposal</div>
    <h1>{{title}}</h1>
    <div class="for">Prepared for {{client_name}}</div>
    <div class="meta">
      From: {{company_name}}<br>
      Date: {{date}}<br>
      Valid until: {{valid_until}}
    </div>
  </div>

  <div class="page">
    <h2>Overview</h2>
    <p>{{overview}}</p>

    <h2>Scope of Work</h2>
    {{#each scope}}
    <div class="scope-card">
      <h3>{{title}}</h3>
      <p>{{description}}</p>
    </div>
    {{/each}}

    <h2>Timeline</h2>
    <div class="timeline">
      {{#each timeline}}
      <div class="timeline-item">
        <div class="timeline-phase">{{phase}}</div>
        <div class="timeline-desc">{{description}}</div>
        <div class="timeline-dates">{{dates}}</div>
      </div>
      {{/each}}
    </div>

    <h2>Investment</h2>
    <table class="pricing-table">
      <thead><tr><th>Item</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        {{#each pricing}}
        <tr><td>{{item}}</td><td>{{description}}</td><td style="text-align:right">\${{amount}}</td></tr>
        {{/each}}
        <tr class="total-row"><td colspan="2">Total Investment</td><td style="text-align:right">\${{total}}</td></tr>
      </tbody>
    </table>

    <div class="cta">
      <h3>Ready to get started?</h3>
      <p>Contact {{contact_name}} at {{contact_email}} to proceed.</p>
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      title: 'Web Application Development',
      client_name: 'TechStart Inc.',
      company_name: 'Acme Development',
      date: 'March 1, 2026',
      valid_until: 'March 31, 2026',
      overview: 'We propose to design and build a modern web application that streamlines your document workflow. The solution will include a responsive dashboard, API integration layer, and automated PDF generation pipeline.',
      scope: [
        { title: 'Discovery & Design', description: 'User research, wireframes, and UI design for all application screens.' },
        { title: 'Frontend Development', description: 'React-based SPA with responsive design, state management, and real-time updates.' },
        { title: 'Backend & API', description: 'Node.js API with PostgreSQL, authentication, and third-party integrations.' },
        { title: 'Testing & Launch', description: 'Automated testing, staging deployment, and production launch with monitoring.' },
      ],
      timeline: [
        { phase: 'Phase 1', description: 'Discovery, research, and design', dates: 'Week 1–2' },
        { phase: 'Phase 2', description: 'Core development', dates: 'Week 3–6' },
        { phase: 'Phase 3', description: 'Integration and testing', dates: 'Week 7–8' },
        { phase: 'Phase 4', description: 'Launch and handoff', dates: 'Week 9–10' },
      ],
      pricing: [
        { item: 'Design', description: 'UI/UX design and prototyping', amount: '8,000' },
        { item: 'Development', description: 'Full-stack application build', amount: '28,000' },
        { item: 'Testing & QA', description: 'Automated and manual testing', amount: '5,000' },
        { item: 'Deployment', description: 'Production setup and monitoring', amount: '4,000' },
      ],
      total: '45,000',
      contact_name: 'Sarah Johnson',
      contact_email: 'sarah@acme.dev',
    },
  },
  {
    slug: 'packing-slip',
    name: 'Packing Slip',
    description: 'Order packing slip with item list, quantities, addresses, and order details.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
  .company-name { font-size: 22px; font-weight: 700; color: #f97316; }
  .doc-title { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1a1a2e; }
  .doc-meta { font-size: 11px; color: #6b7280; text-align: right; margin-top: 6px; line-height: 1.8; }
  .doc-meta strong { color: #1a1a2e; }
  .addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
  .address-block { }
  .address-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
  .address-name { font-size: 14px; font-weight: 600; }
  .address-line { font-size: 12px; color: #6b7280; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #f8fafc; padding: 10px 14px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; text-align: left; border-bottom: 2px solid #e5e7eb; }
  tbody td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .sku { font-family: monospace; font-size: 11px; color: #9ca3af; }
  .qty { text-align: center; font-weight: 600; }
  .check { text-align: center; width: 60px; }
  .checkbox { width: 16px; height: 16px; border: 2px solid #d1d5db; border-radius: 3px; display: inline-block; }
  .notes { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 24px; }
  .notes-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
  .notes-text { font-size: 12px; color: #6b7280; line-height: 1.6; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">{{company_name}}</div>
      <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">{{company_address}}</div>
    </div>
    <div>
      <div class="doc-title">Packing Slip</div>
      <div class="doc-meta">
        <strong>Order #:</strong> {{order_number}}<br>
        <strong>Date:</strong> {{order_date}}<br>
        <strong>Ship Method:</strong> {{ship_method}}
      </div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <div class="address-label">Ship To</div>
      <div class="address-name">{{ship_to_name}}</div>
      <div class="address-line">{{ship_to_address}}<br>{{ship_to_city_state_zip}}</div>
    </div>
    <div class="address-block">
      <div class="address-label">Bill To</div>
      <div class="address-name">{{bill_to_name}}</div>
      <div class="address-line">{{bill_to_address}}<br>{{bill_to_city_state_zip}}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="check">Packed</th>
        <th>Item</th>
        <th>SKU</th>
        <th style="text-align: center;">Qty Ordered</th>
        <th style="text-align: center;">Qty Shipped</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td class="check"><span class="checkbox"></span></td>
        <td><strong>{{name}}</strong>{{#if variant}}<br><span style="font-size: 11px; color: #6b7280;">{{variant}}</span>{{/if}}</td>
        <td class="sku">{{sku}}</td>
        <td class="qty">{{qty_ordered}}</td>
        <td class="qty">{{qty_shipped}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  {{#if notes}}
  <div class="notes">
    <div class="notes-title">Special Instructions</div>
    <div class="notes-text">{{notes}}</div>
  </div>
  {{/if}}

  <div class="footer">
    Thank you for your order! &middot; {{company_name}} &middot; {{company_email}}
  </div>
</body>
</html>`,
    sampleData: {
      company_name: 'Acme Store',
      company_address: '123 Commerce St, San Francisco, CA 94107',
      company_email: 'orders@acme.com',
      order_number: 'ORD-2026-1847',
      order_date: 'February 25, 2026',
      ship_method: 'UPS Ground (3-5 days)',
      ship_to_name: 'Jane Doe',
      ship_to_address: '456 Oak Street, Apt 2B',
      ship_to_city_state_zip: 'New York, NY 10001',
      bill_to_name: 'Jane Doe',
      bill_to_address: '456 Oak Street, Apt 2B',
      bill_to_city_state_zip: 'New York, NY 10001',
      items: [
        { name: 'Wireless Keyboard', variant: 'Space Gray', sku: 'KB-WL-001', qty_ordered: 1, qty_shipped: 1 },
        { name: 'USB-C Hub', variant: '7-in-1', sku: 'HUB-7C-002', qty_ordered: 2, qty_shipped: 2 },
        { name: 'Laptop Stand', variant: 'Aluminum, Silver', sku: 'STD-AL-003', qty_ordered: 1, qty_shipped: 1 },
      ],
      notes: 'Please leave package at the front door if no one is home. Fragile items inside — handle with care.',
    },
  },
  {
    slug: 'letter',
    name: 'Business Letter',
    description: 'Formal business letter with letterhead, date, addresses, salutation, and closing.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a2e; padding: 50px 60px; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #f97316; margin-bottom: 30px; }
  .company-name { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 22px; font-weight: 700; color: #f97316; }
  .company-info { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #6b7280; text-align: right; line-height: 1.8; }
  .date { font-size: 13px; color: #4b5563; margin-bottom: 24px; }
  .recipient { font-size: 13px; line-height: 1.7; margin-bottom: 24px; color: #4b5563; }
  .subject { font-size: 13px; font-weight: 700; margin-bottom: 20px; }
  .salutation { font-size: 13px; margin-bottom: 16px; }
  .body-text { font-size: 13px; line-height: 1.9; color: #4b5563; }
  .body-text p { margin-bottom: 14px; }
  .closing { margin-top: 30px; font-size: 13px; }
  .sig-space { height: 50px; }
  .sig-name { font-weight: 700; }
  .sig-title { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .enclosure { margin-top: 30px; font-size: 11px; color: #9ca3af; font-style: italic; }
</style>
</head>
<body>
  <div class="letterhead">
    <div class="company-name">{{company_name}}</div>
    <div class="company-info">
      {{company_address}}<br>
      {{company_phone}}<br>
      {{company_email}}<br>
      {{company_website}}
    </div>
  </div>

  <div class="date">{{date}}</div>

  <div class="recipient">
    {{recipient_name}}<br>
    {{#if recipient_title}}{{recipient_title}}<br>{{/if}}
    {{recipient_company}}<br>
    {{recipient_address}}
  </div>

  {{#if subject}}
  <div class="subject">Re: {{subject}}</div>
  {{/if}}

  <div class="salutation">Dear {{salutation}},</div>

  <div class="body-text">
    {{#each paragraphs}}
    <p>{{this}}</p>
    {{/each}}
  </div>

  <div class="closing">
    {{closing}},
    <div class="sig-space"></div>
    <div class="sig-name">{{sender_name}}</div>
    <div class="sig-title">{{sender_title}}</div>
  </div>

  {{#if enclosures}}
  <div class="enclosure">
    Enclosures: {{enclosures}}
  </div>
  {{/if}}
</body>
</html>`,
    sampleData: {
      company_name: 'Acme Corp',
      company_address: '123 Business Ave, San Francisco, CA 94107',
      company_phone: '(415) 555-0100',
      company_email: 'info@acme.com',
      company_website: 'www.acme.com',
      date: 'March 1, 2026',
      recipient_name: 'Mr. Michael Chen',
      recipient_title: 'Chief Technology Officer',
      recipient_company: 'TechStart Inc.',
      recipient_address: '456 Innovation Blvd, Austin, TX 78701',
      subject: 'Partnership Opportunity',
      salutation: 'Mr. Chen',
      paragraphs: [
        'I am writing to express our interest in establishing a strategic partnership between Acme Corp and TechStart Inc. After following your company\'s impressive growth over the past year, we believe there is a natural alignment between our organizations that could benefit both parties.',
        'Acme Corp has been a leader in document automation solutions for over five years, serving more than 2,000 enterprise clients globally. Our API-first approach to PDF generation has been widely adopted by development teams looking for reliable, scalable document infrastructure.',
        'We would welcome the opportunity to discuss how our platforms might integrate to deliver enhanced value to our mutual customers. I would be happy to arrange a meeting at your convenience to explore this further.',
        'Thank you for your consideration. I look forward to hearing from you.',
      ],
      closing: 'Sincerely',
      sender_name: 'Sarah Johnson',
      sender_title: 'VP of Business Development, Acme Corp',
      enclosures: 'Company Overview, Product Brochure',
    },
  },
  {
    slug: 'meeting-minutes',
    name: 'Meeting Minutes',
    description: 'Structured meeting minutes with attendees, agenda items, action items, and decisions.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; line-height: 1.6; }
  .header { border-bottom: 3px solid #f97316; padding-bottom: 20px; margin-bottom: 30px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .doc-title { font-size: 24px; font-weight: 700; color: #1a1a2e; }
  .doc-subtitle { font-size: 16px; color: #f97316; font-weight: 600; margin-top: 4px; }
  .meta-badge { background: #fff7ed; color: #f97316; font-size: 10px; font-weight: 600; padding: 4px 12px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .meta-item { font-size: 11px; color: #6b7280; }
  .meta-item strong { color: #1a1a2e; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 14px; font-weight: 700; color: #1a1a2e; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .attendee-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .attendee { font-size: 11px; padding: 4px 0; }
  .attendee .name { font-weight: 600; color: #1a1a2e; }
  .attendee .role { color: #9ca3af; }
  .agenda-item { margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #f97316; }
  .agenda-item h3 { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; }
  .agenda-item p { font-size: 11px; color: #4b5563; }
  .decision { background: #ecfdf5; border-left: 3px solid #059669; padding: 8px 12px; border-radius: 4px; margin-top: 8px; font-size: 11px; color: #065f46; }
  .decision::before { content: 'Decision: '; font-weight: 700; }
  .action-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .action-table th { background: #1a1a2e; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 12px; text-align: left; }
  .action-table td { padding: 8px 12px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
  .action-table tr:nth-child(even) { background: #f8fafc; }
  .priority-high { color: #dc2626; font-weight: 600; }
  .priority-medium { color: #d97706; font-weight: 600; }
  .priority-low { color: #059669; font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="doc-title">Meeting Minutes</div>
        <div class="doc-subtitle">{{meeting_title}}</div>
      </div>
      <div class="meta-badge">{{meeting_type}}</div>
    </div>
    <div class="meta-grid">
      <div class="meta-item"><strong>Date:</strong> {{date}}</div>
      <div class="meta-item"><strong>Time:</strong> {{time}}</div>
      <div class="meta-item"><strong>Location:</strong> {{location}}</div>
      <div class="meta-item"><strong>Facilitator:</strong> {{facilitator}}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Attendees</div>
    <div class="attendee-grid">
      {{#each attendees}}
      <div class="attendee"><span class="name">{{name}}</span> <span class="role">— {{role}}</span></div>
      {{/each}}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Agenda &amp; Discussion</div>
    {{#each agenda_items}}
    <div class="agenda-item">
      <h3>{{title}}</h3>
      <p>{{notes}}</p>
      {{#if decision}}
      <div class="decision">{{decision}}</div>
      {{/if}}
    </div>
    {{/each}}
  </div>

  <div class="section">
    <div class="section-title">Action Items</div>
    <table class="action-table">
      <thead>
        <tr><th>Action</th><th>Owner</th><th>Due Date</th><th>Priority</th></tr>
      </thead>
      <tbody>
        {{#each action_items}}
        <tr>
          <td>{{description}}</td>
          <td>{{owner}}</td>
          <td>{{due_date}}</td>
          <td class="priority-{{priority}}">{{priority}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  {{#if next_meeting}}
  <div class="section">
    <div class="section-title">Next Meeting</div>
    <p style="font-size: 11px; color: #4b5563;">{{next_meeting}}</p>
  </div>
  {{/if}}

  <div class="footer">
    <div>Prepared by {{facilitator}}</div>
    <div>{{date}}</div>
  </div>
</body>
</html>`,
    sampleData: {
      meeting_title: 'Q1 Product Roadmap Review',
      meeting_type: 'Weekly Standup',
      date: 'March 10, 2026',
      time: '10:00 AM — 11:30 AM',
      location: 'Conference Room A / Zoom',
      facilitator: 'Sarah Johnson',
      attendees: [
        { name: 'Sarah Johnson', role: 'Product Manager' },
        { name: 'David Park', role: 'Engineering Lead' },
        { name: 'Emily Carter', role: 'Designer' },
        { name: 'James Liu', role: 'Backend Developer' },
        { name: 'Maria Santos', role: 'QA Engineer' },
        { name: 'Alex Kim', role: 'DevOps' },
      ],
      agenda_items: [
        { title: '1. Sprint Review', notes: 'Completed 14 of 16 planned story points. Two items moved to next sprint due to API dependency delays.', decision: 'Carry over remaining items and re-prioritize next sprint.' },
        { title: '2. Template Editor Redesign', notes: 'Emily presented the updated wireframes for the drag-and-drop editor. The team discussed accessibility improvements and mobile responsiveness.', decision: 'Approve wireframes for development. Target beta release in 3 weeks.' },
        { title: '3. Infrastructure Updates', notes: 'Alex proposed migrating the PDF rendering pipeline to a new browser pool architecture for improved performance and reliability.' },
      ],
      action_items: [
        { description: 'Draft revised sprint backlog', owner: 'Sarah Johnson', due_date: 'March 12', priority: 'high' },
        { description: 'Create component library for editor', owner: 'Emily Carter', due_date: 'March 17', priority: 'medium' },
        { description: 'Benchmark browser pool options', owner: 'Alex Kim', due_date: 'March 14', priority: 'high' },
        { description: 'Write integration tests for batch API', owner: 'James Liu', due_date: 'March 19', priority: 'medium' },
      ],
      next_meeting: 'March 17, 2026 at 10:00 AM — Conference Room A / Zoom',
    },
  },
  {
    slug: 'nda',
    name: 'Non-Disclosure Agreement',
    description: 'Standard mutual NDA with defined terms, obligations, and signature blocks.',
    category: 'legal',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a2e; padding: 50px 60px; font-size: 12px; line-height: 1.8; }
  .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1a1a2e; padding-bottom: 24px; }
  .title { font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1a1a2e; }
  .subtitle { font-size: 11px; color: #6b7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .effective-date { font-size: 12px; margin-top: 12px; color: #4b5563; }
  .parties { margin-bottom: 30px; padding: 16px 20px; background: #f8fafc; border-radius: 4px; }
  .parties p { margin-bottom: 8px; }
  .parties strong { color: #1a1a2e; }
  .section { margin-bottom: 20px; }
  .section-num { font-weight: 700; color: #f97316; margin-right: 6px; }
  .section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a2e; margin-bottom: 8px; }
  .section p { text-align: justify; margin-bottom: 8px; }
  .obligations-list { padding-left: 24px; margin: 8px 0; }
  .obligations-list li { margin-bottom: 6px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .sig-block { margin-top: 20px; }
  .sig-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .sig-line { border-bottom: 1px solid #1a1a2e; height: 40px; margin-bottom: 4px; }
  .sig-info { font-size: 11px; color: #4b5563; }
  .sig-info strong { color: #1a1a2e; display: block; }
  .footer { margin-top: 40px; text-align: center; font-size: 9px; color: #d1d5db; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">Non-Disclosure Agreement</div>
    <div class="subtitle">Mutual Confidentiality Agreement</div>
    <div class="effective-date">Effective Date: {{effective_date}}</div>
  </div>

  <div class="parties">
    <p><strong>Disclosing Party:</strong> {{party_a_name}}, {{party_a_entity_type}}, with its principal office at {{party_a_address}} ("Party A")</p>
    <p><strong>Receiving Party:</strong> {{party_b_name}}, {{party_b_entity_type}}, with its principal office at {{party_b_address}} ("Party B")</p>
  </div>

  <div class="section">
    <h2><span class="section-num">1.</span> Purpose</h2>
    <p>The parties wish to explore a potential business relationship concerning {{purpose}} (the "Purpose"). In connection with this Purpose, each party may disclose certain confidential and proprietary information to the other party.</p>
  </div>

  <div class="section">
    <h2><span class="section-num">2.</span> Definition of Confidential Information</h2>
    <p>"Confidential Information" means any and all non-public information, including but not limited to technical, business, financial, customer, and product development information, disclosed by either party in written, oral, electronic, or visual form.</p>
  </div>

  <div class="section">
    <h2><span class="section-num">3.</span> Obligations</h2>
    <p>The receiving party agrees to:</p>
    <ul class="obligations-list">
      <li>Maintain the confidentiality of all Confidential Information;</li>
      <li>Not disclose Confidential Information to any third party without prior written consent;</li>
      <li>Use Confidential Information solely for the Purpose described herein;</li>
      <li>Protect Confidential Information with at least the same degree of care used to protect its own confidential information.</li>
    </ul>
  </div>

  <div class="section">
    <h2><span class="section-num">4.</span> Exclusions</h2>
    <p>Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was known to the receiving party prior to disclosure; (c) is independently developed without use of the Confidential Information; or (d) is rightfully obtained from a third party without restriction.</p>
  </div>

  <div class="section">
    <h2><span class="section-num">5.</span> Term</h2>
    <p>This Agreement shall remain in effect for a period of {{term_years}} year(s) from the Effective Date. Obligations of confidentiality shall survive termination for an additional {{survival_years}} year(s).</p>
  </div>

  <div class="section">
    <h2><span class="section-num">6.</span> Governing Law</h2>
    <p>This Agreement shall be governed by the laws of the State of {{governing_state}}, without regard to conflicts of law principles.</p>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-label">Party A</div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-info">
          <strong>{{party_a_signer}}</strong>
          {{party_a_signer_title}}<br>
          {{party_a_name}}<br>
          Date: _______________
        </div>
      </div>
    </div>
    <div>
      <div class="sig-label">Party B</div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-info">
          <strong>{{party_b_signer}}</strong>
          {{party_b_signer_title}}<br>
          {{party_b_name}}<br>
          Date: _______________
        </div>
      </div>
    </div>
  </div>

  <div class="footer">Agreement ID: {{agreement_id}}</div>
</body>
</html>`,
    sampleData: {
      effective_date: 'March 1, 2026',
      party_a_name: 'Acme Corp',
      party_a_entity_type: 'a Delaware corporation',
      party_a_address: '123 Business Ave, San Francisco, CA 94107',
      party_a_signer: 'Sarah Johnson',
      party_a_signer_title: 'VP of Business Development',
      party_b_name: 'TechStart Inc.',
      party_b_entity_type: 'a California corporation',
      party_b_address: '456 Innovation Blvd, Austin, TX 78701',
      party_b_signer: 'Michael Chen',
      party_b_signer_title: 'Chief Executive Officer',
      purpose: 'a potential technology partnership and API integration',
      term_years: '2',
      survival_years: '3',
      governing_state: 'California',
      agreement_id: 'NDA-2026-00314',
    },
  },
  {
    slug: 'event-ticket',
    name: 'Event Ticket',
    description: 'Printable event ticket with QR code, seat info, and event details.',
    category: 'marketing',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: 8in 4in; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  .ticket { width: 8in; height: 4in; display: flex; position: relative; background: white; }
  .main { flex: 1; padding: 30px; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, #1a1a2e 0%, #2d2b55 100%); color: white; }
  .stub { width: 2.2in; padding: 24px 20px; background: #f97316; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative; }
  .stub::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 1px; border-left: 2px dashed rgba(255,255,255,0.3); }
  .event-name { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.2; }
  .event-tagline { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .detail-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5); margin-bottom: 2px; }
  .detail-value { font-size: 13px; font-weight: 600; }
  .ticket-footer { display: flex; justify-content: space-between; align-items: flex-end; }
  .ticket-id { font-size: 9px; color: rgba(255,255,255,0.4); font-family: monospace; }
  .attendee-name { font-size: 11px; color: rgba(255,255,255,0.7); }
  .stub-event { font-size: 12px; font-weight: 700; margin-bottom: 16px; }
  .stub-detail { font-size: 10px; margin-bottom: 4px; opacity: 0.9; }
  .stub-seat { font-size: 28px; font-weight: 800; margin: 12px 0; letter-spacing: 1px; }
  .stub-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.7; }
  .qr-area { margin-top: 12px; background: white; padding: 8px; border-radius: 6px; display: inline-block; }
</style>
</head>
<body>
  <div class="ticket">
    <div class="main">
      <div>
        <div class="event-name">{{event_name}}</div>
        {{#if tagline}}<div class="event-tagline">{{tagline}}</div>{{/if}}
      </div>
      <div class="detail-grid">
        <div>
          <div class="detail-label">Date</div>
          <div class="detail-value">{{event_date}}</div>
        </div>
        <div>
          <div class="detail-label">Time</div>
          <div class="detail-value">{{event_time}}</div>
        </div>
        <div>
          <div class="detail-label">Venue</div>
          <div class="detail-value">{{venue}}</div>
        </div>
        <div>
          <div class="detail-label">Ticket Type</div>
          <div class="detail-value">{{ticket_type}}</div>
        </div>
      </div>
      <div class="ticket-footer">
        <div>
          <div class="attendee-name">{{attendee_name}}</div>
          <div class="ticket-id">{{ticket_id}}</div>
        </div>
        <div class="ticket-id">{{barcode:{{ticket_id}}}}</div>
      </div>
    </div>
    <div class="stub">
      <div class="stub-event">{{event_name}}</div>
      <div class="stub-detail">{{event_date}}</div>
      <div class="stub-detail">{{event_time}}</div>
      <div class="stub-label">Seat</div>
      <div class="stub-seat">{{seat}}</div>
      <div class="qr-area">{{qr:{{ticket_id}}}}</div>
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      event_name: 'DevForge Summit 2026',
      tagline: 'The Future of Developer Tools',
      event_date: 'April 15, 2026',
      event_time: '9:00 AM — 6:00 PM',
      venue: 'Moscone Center, San Francisco',
      ticket_type: 'VIP All-Access',
      attendee_name: 'Alexandra Chen',
      seat: 'A-12',
      ticket_id: 'TKT-2026-04158',
    },
  },
  {
    slug: 'purchase-order',
    name: 'Purchase Order',
    description: 'Professional purchase order with line items, shipping details, and approval signatures.',
    category: 'finance',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #f97316; }
  .company-name { font-size: 22px; font-weight: 700; color: #f97316; }
  .company-details { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
  .po-title { font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: right; }
  .po-number { font-size: 14px; color: #f97316; font-weight: 600; text-align: right; margin-top: 4px; }
  .po-date { font-size: 11px; color: #6b7280; text-align: right; margin-top: 4px; }
  .address-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
  .address-box { padding: 16px; background: #f8fafc; border-radius: 6px; border-top: 3px solid #f97316; }
  .address-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #f97316; font-weight: 700; margin-bottom: 8px; }
  .address-box p { font-size: 11px; color: #4b5563; line-height: 1.6; }
  .address-box strong { color: #1a1a2e; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .items-table th { background: #1a1a2e; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; text-align: left; }
  .items-table th:nth-child(3), .items-table th:nth-child(4), .items-table th:nth-child(5) { text-align: right; }
  .items-table td { padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
  .items-table td:nth-child(3), .items-table td:nth-child(4), .items-table td:nth-child(5) { text-align: right; }
  .items-table tr:nth-child(even) { background: #f8fafc; }
  .item-desc { font-size: 10px; color: #9ca3af; margin-top: 2px; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
  .totals-box { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 11px; color: #4b5563; }
  .totals-row.total { border-top: 2px solid #1a1a2e; padding-top: 10px; margin-top: 6px; font-size: 14px; font-weight: 700; color: #1a1a2e; }
  .terms { margin-bottom: 30px; padding: 16px; background: #f8fafc; border-radius: 6px; }
  .terms h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a2e; margin-bottom: 8px; }
  .terms p { font-size: 10px; color: #6b7280; line-height: 1.6; }
  .approval { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .sig-block label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line { border-bottom: 1px solid #1a1a2e; height: 36px; margin: 8px 0 4px; }
  .sig-info { font-size: 10px; color: #6b7280; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">{{company_name}}</div>
      <div class="company-details">{{company_address}}<br>{{company_phone}} &middot; {{company_email}}</div>
    </div>
    <div>
      <div class="po-title">Purchase Order</div>
      <div class="po-number">{{po_number}}</div>
      <div class="po-date">Date: {{date}}<br>Required by: {{delivery_date}}</div>
    </div>
  </div>

  <div class="address-grid">
    <div class="address-box">
      <h3>Vendor</h3>
      <p><strong>{{vendor_name}}</strong><br>{{vendor_address}}<br>{{vendor_contact}}</p>
    </div>
    <div class="address-box">
      <h3>Ship To</h3>
      <p><strong>{{ship_to_name}}</strong><br>{{ship_to_address}}<br>Attn: {{ship_to_contact}}</p>
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{sku}}</td>
        <td>{{name}}<div class="item-desc">{{description}}</div></td>
        <td>{{quantity}}</td>
        <td>\${{unit_price}}</td>
        <td>\${{total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><span>\${{subtotal}}</span></div>
      <div class="totals-row"><span>Shipping</span><span>\${{shipping}}</span></div>
      <div class="totals-row"><span>Tax ({{tax_rate}})</span><span>\${{tax}}</span></div>
      <div class="totals-row total"><span>Total</span><span>\${{total}}</span></div>
    </div>
  </div>

  <div class="terms">
    <h3>Terms &amp; Conditions</h3>
    <p>{{terms}}</p>
  </div>

  <div class="approval">
    <div class="sig-block">
      <label>Authorized By</label>
      <div class="sig-line"></div>
      <div class="sig-info">{{authorized_by}} — {{authorized_title}}</div>
    </div>
    <div class="sig-block">
      <label>Approved By</label>
      <div class="sig-line"></div>
      <div class="sig-info">{{approved_by}} — {{approved_title}}</div>
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      company_name: 'Acme Corp',
      company_address: '123 Business Ave, San Francisco, CA 94107',
      company_phone: '(415) 555-0100',
      company_email: 'procurement@acme.com',
      po_number: 'PO-2026-00892',
      date: 'March 5, 2026',
      delivery_date: 'March 20, 2026',
      vendor_name: 'Office Supply Co.',
      vendor_address: '789 Vendor Blvd, Chicago, IL 60601',
      vendor_contact: 'orders@officesupply.com',
      ship_to_name: 'Acme Corp — Engineering',
      ship_to_address: '123 Business Ave, Floor 4, San Francisco, CA 94107',
      ship_to_contact: 'David Park',
      items: [
        { sku: 'MON-27-4K', name: '27" 4K Monitor', description: 'IPS panel, USB-C, adjustable stand', quantity: '5', unit_price: '449.00', total: '2,245.00' },
        { sku: 'KB-MEC-WL', name: 'Mechanical Keyboard', description: 'Wireless, low-profile switches', quantity: '5', unit_price: '129.00', total: '645.00' },
        { sku: 'DOCK-USB4', name: 'USB4 Docking Station', description: 'Triple display, 100W PD charging', quantity: '5', unit_price: '199.00', total: '995.00' },
        { sku: 'CHAIR-ERG', name: 'Ergonomic Office Chair', description: 'Mesh back, lumbar support, adjustable arms', quantity: '3', unit_price: '599.00', total: '1,797.00' },
      ],
      subtotal: '5,682.00',
      shipping: '150.00',
      tax_rate: '8.625%',
      tax: '489.97',
      total: '6,321.97',
      terms: 'Net 30. Goods must be delivered by the Required By date. All items must match specifications. Damaged goods will be returned at vendor expense. This purchase order is subject to the standard terms and conditions of Acme Corp.',
      authorized_by: 'David Park',
      authorized_title: 'Engineering Lead',
      approved_by: 'Sarah Johnson',
      approved_title: 'VP of Operations',
    },
  },
  {
    slug: 'report-card',
    name: 'Student Report Card',
    description: 'Academic report card with grades, teacher comments, and attendance summary.',
    category: 'business',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; }
  .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #f97316; }
  .school-name { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  .school-address { font-size: 10px; color: #6b7280; margin-top: 4px; }
  .report-title { font-size: 16px; font-weight: 600; color: #f97316; margin-top: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .student-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 6px; }
  .info-item { font-size: 11px; }
  .info-item .label { color: #9ca3af; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .info-item .value { font-weight: 600; color: #1a1a2e; }
  .grades-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  .grades-table th { background: #1a1a2e; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; text-align: left; }
  .grades-table th:nth-child(3), .grades-table th:nth-child(4) { text-align: center; }
  .grades-table td { padding: 10px 12px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
  .grades-table td:nth-child(3), .grades-table td:nth-child(4) { text-align: center; }
  .grades-table tr:nth-child(even) { background: #f8fafc; }
  .grade-badge { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; border-radius: 50%; font-weight: 700; font-size: 11px; }
  .grade-a { background: #ecfdf5; color: #059669; }
  .grade-b { background: #eff6ff; color: #2563eb; }
  .grade-c { background: #fffbeb; color: #d97706; }
  .grade-d { background: #fef2f2; color: #dc2626; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .summary-box { padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb; }
  .summary-box h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a2e; margin-bottom: 8px; }
  .attendance-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center; }
  .att-num { font-size: 20px; font-weight: 700; color: #f97316; }
  .att-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; }
  .gpa-display { text-align: center; }
  .gpa-num { font-size: 36px; font-weight: 800; color: #f97316; }
  .gpa-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .gpa-scale { font-size: 9px; color: #d1d5db; margin-top: 2px; }
  .comments { padding: 16px; background: #f8fafc; border-radius: 6px; margin-bottom: 24px; border-left: 3px solid #f97316; }
  .comments h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a2e; margin-bottom: 8px; }
  .comments p { font-size: 11px; color: #4b5563; line-height: 1.7; font-style: italic; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .sig-block label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line { border-bottom: 1px solid #1a1a2e; height: 30px; margin-top: 6px; }
  .sig-name { font-size: 10px; color: #6b7280; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="school-name">{{school_name}}</div>
    <div class="school-address">{{school_address}}</div>
    <div class="report-title">Academic Report Card — {{term}}</div>
  </div>

  <div class="student-info">
    <div class="info-item"><div class="label">Student Name</div><div class="value">{{student_name}}</div></div>
    <div class="info-item"><div class="label">Student ID</div><div class="value">{{student_id}}</div></div>
    <div class="info-item"><div class="label">Grade Level</div><div class="value">{{grade_level}}</div></div>
    <div class="info-item"><div class="label">Homeroom</div><div class="value">{{homeroom}}</div></div>
    <div class="info-item"><div class="label">Academic Year</div><div class="value">{{academic_year}}</div></div>
    <div class="info-item"><div class="label">Report Date</div><div class="value">{{report_date}}</div></div>
  </div>

  <table class="grades-table">
    <thead>
      <tr><th>Subject</th><th>Teacher</th><th>Grade</th><th>Score</th><th>Comments</th></tr>
    </thead>
    <tbody>
      {{#each subjects}}
      <tr>
        <td style="font-weight:600;">{{name}}</td>
        <td>{{teacher}}</td>
        <td><span class="grade-badge grade-{{grade_class}}">{{grade}}</span></td>
        <td>{{score}}%</td>
        <td style="font-size:10px; color:#6b7280;">{{comment}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="summary-grid">
    <div class="summary-box">
      <h3>Attendance Summary</h3>
      <div class="attendance-grid">
        <div><div class="att-num">{{days_present}}</div><div class="att-label">Present</div></div>
        <div><div class="att-num">{{days_absent}}</div><div class="att-label">Absent</div></div>
        <div><div class="att-num">{{days_tardy}}</div><div class="att-label">Tardy</div></div>
      </div>
    </div>
    <div class="summary-box">
      <h3>Cumulative GPA</h3>
      <div class="gpa-display">
        <div class="gpa-num">{{gpa}}</div>
        <div class="gpa-label">Grade Point Average</div>
        <div class="gpa-scale">on a 4.0 scale</div>
      </div>
    </div>
  </div>

  <div class="comments">
    <h3>Teacher Comments</h3>
    <p>{{teacher_comments}}</p>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <label>Principal</label>
      <div class="sig-line"></div>
      <div class="sig-name">{{principal_name}}</div>
    </div>
    <div class="sig-block">
      <label>Homeroom Teacher</label>
      <div class="sig-line"></div>
      <div class="sig-name">{{homeroom_teacher}}</div>
    </div>
    <div class="sig-block">
      <label>Parent / Guardian</label>
      <div class="sig-line"></div>
      <div class="sig-name">Date: ___________</div>
    </div>
  </div>
</body>
</html>`,
    sampleData: {
      school_name: 'Westfield Academy',
      school_address: '500 Oak Street, Portland, OR 97201 • (503) 555-0200',
      term: 'Fall Semester',
      student_name: 'Emma Richardson',
      student_id: 'STU-2026-1847',
      grade_level: '10th Grade',
      homeroom: 'Room 204',
      academic_year: '2025-2026',
      report_date: 'January 15, 2026',
      subjects: [
        { name: 'English Literature', teacher: 'Ms. Harper', grade: 'A', grade_class: 'a', score: '94', comment: 'Excellent analytical essays' },
        { name: 'Algebra II', teacher: 'Mr. Tanaka', grade: 'A-', grade_class: 'a', score: '91', comment: 'Strong problem-solving skills' },
        { name: 'Biology', teacher: 'Dr. Okafor', grade: 'B+', grade_class: 'b', score: '88', comment: 'Great lab work, improve test prep' },
        { name: 'World History', teacher: 'Ms. Chen', grade: 'A', grade_class: 'a', score: '96', comment: 'Outstanding research projects' },
        { name: 'Spanish II', teacher: 'Sr. Rodriguez', grade: 'B', grade_class: 'b', score: '85', comment: 'Improving conversational fluency' },
        { name: 'Computer Science', teacher: 'Mr. Patel', grade: 'A+', grade_class: 'a', score: '98', comment: 'Exceptional coding projects' },
        { name: 'Physical Education', teacher: 'Coach Williams', grade: 'A', grade_class: 'a', score: '95', comment: 'Excellent participation and teamwork' },
      ],
      days_present: '82',
      days_absent: '3',
      days_tardy: '1',
      gpa: '3.78',
      teacher_comments: 'Emma is a dedicated and curious student who consistently demonstrates a strong work ethic across all subjects. She is a positive contributor to class discussions and works collaboratively with her peers. I encourage Emma to continue challenging herself with advanced coursework next semester.',
      principal_name: 'Dr. Margaret Foster',
      homeroom_teacher: 'Ms. Harper',
    },
  },
];
