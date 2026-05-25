/**
 * Drip-campaign email templates.
 *
 * Kept as plain TS string builders rather than React Email to avoid a new
 * runtime dependency. Each template returns `{ subject, html }`. The email
 * service generates plain-text automatically.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface TemplateContext {
  email: string;
  dashboardUrl: string;
  playgroundUrl: string;
  keysUrl: string;
  marketplaceUrl: string;
  docsUrl: string;
  unsubscribeUrl?: string;
  founderEmail?: string;
}

function layout(bodyHtml: string, ctx: TemplateContext): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Deckle</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#FAFAFA;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0A0A0B;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#111113;border:1px solid #232326;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <div style="font-size:20px;font-weight:700;color:#F97316;letter-spacing:-0.5px;">Deckle</div>
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;">Stripe for PDFs</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 32px 32px;color:#FAFAFA;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #232326;font-size:11px;color:#6b7280;line-height:1.5;">
              You're getting this because you signed up for Deckle with ${ctx.email}.
              ${ctx.unsubscribeUrl ? `<a href="${ctx.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>.` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#F97316;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;">${label}</a>`;
}

export function welcomeEmail(ctx: TemplateContext): EmailTemplate {
  return {
    subject: 'Welcome to Deckle — your first PDF is one click away',
    html: layout(
      `
      <h1 style="font-size:22px;font-weight:800;margin:0 0 12px 0;color:#FAFAFA;">Welcome to Deckle.</h1>
      <p style="margin:0 0 16px 0;">Thanks for signing up. Deckle turns HTML or templates into pixel-perfect PDFs through a single API call.</p>
      <p style="margin:0 0 20px 0;">You don't need to write any code to try it. Open the playground, pick a starter (invoice, receipt, report, contract), and watch a real PDF render in seconds.</p>
      <div style="margin:24px 0;">${button(ctx.playgroundUrl, 'Generate your first PDF →')}</div>
      <p style="margin:0 0 8px 0;color:#9ca3af;font-size:13px;">When you're ready to call the API from your own code:</p>
      <ol style="margin:0 0 0 20px;padding:0;color:#9ca3af;font-size:13px;line-height:1.8;">
        <li><a href="${ctx.keysUrl}" style="color:#F97316;">Create an API key</a> (you'll see the plaintext once — copy it).</li>
        <li>Install an SDK: <code style="background:#1a1a1d;padding:2px 6px;border-radius:4px;font-size:12px;">npm install @getdeckle/sdk</code></li>
        <li>Call <code style="background:#1a1a1d;padding:2px 6px;border-radius:4px;font-size:12px;">df.generate({ html })</code>.</li>
      </ol>
      <p style="margin:20px 0 0 0;color:#6b7280;font-size:12px;">Questions? Just reply to this email.</p>
    `,
      ctx,
    ),
  };
}

export function nudge1Email(ctx: TemplateContext): EmailTemplate {
  return {
    subject: 'Your first PDF in under 5 minutes',
    html: layout(
      `
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px 0;color:#FAFAFA;">Still on the fence?</h1>
      <p style="margin:0 0 16px 0;">It takes about a minute to see Deckle in action. No code, no API key — the dashboard playground renders a real PDF live in the browser.</p>
      <p style="margin:0 0 20px 0;">Pick any starter and click <strong>Generate</strong>:</p>
      <ul style="margin:0 0 20px 20px;padding:0;color:#FAFAFA;font-size:14px;line-height:1.8;">
        <li>Invoice (line items, tax, totals)</li>
        <li>Receipt (customer-facing)</li>
        <li>Report (multi-page, charts, tables)</li>
        <li>Contract / NDA (legal formatting)</li>
      </ul>
      <div style="margin:24px 0;">${button(ctx.playgroundUrl, 'Open the playground →')}</div>
      <p style="margin:20px 0 0 0;color:#6b7280;font-size:12px;">If something felt broken last time, reply and tell me — I read every message.</p>
    `,
      ctx,
    ),
  };
}

export function nudge2Email(ctx: TemplateContext): EmailTemplate {
  return {
    subject: 'How other developers use Deckle',
    html: layout(
      `
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px 0;color:#FAFAFA;">A few examples from real users.</h1>
      <p style="margin:0 0 20px 0;">Most Deckle customers started with one of these three flows. Worth seeing if any of them map to what you're building:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
        <tr>
          <td style="padding:14px 16px;background:#1a1a1d;border:1px solid #232326;border-radius:8px;">
            <div style="font-weight:700;color:#F97316;font-size:13px;margin-bottom:4px;">1. Checkout → Invoice</div>
            <div style="color:#d1d5db;font-size:13px;line-height:1.5;">Stripe webhook fires, you call <code>df.fromTemplate('invoice', data)</code>, email the URL to the customer.</div>
          </td>
        </tr>
        <tr><td style="height:10px;"></td></tr>
        <tr>
          <td style="padding:14px 16px;background:#1a1a1d;border:1px solid #232326;border-radius:8px;">
            <div style="font-weight:700;color:#F97316;font-size:13px;margin-bottom:4px;">2. Dashboard → Report export</div>
            <div style="color:#d1d5db;font-size:13px;line-height:1.5;">User clicks &quot;Export PDF,&quot; your backend renders their data through a saved template, returns the URL.</div>
          </td>
        </tr>
        <tr><td style="height:10px;"></td></tr>
        <tr>
          <td style="padding:14px 16px;background:#1a1a1d;border:1px solid #232326;border-radius:8px;">
            <div style="font-weight:700;color:#F97316;font-size:13px;margin-bottom:4px;">3. E-sign → Contract PDF</div>
            <div style="color:#d1d5db;font-size:13px;line-height:1.5;">Form submission triggers a contract template with the client's data, signature is stamped via <code>/v1/pdf/sign</code>.</div>
          </td>
        </tr>
      </table>
      <div style="margin:20px 0;">${button(ctx.marketplaceUrl, 'Browse templates →')}</div>
    `,
      ctx,
    ),
  };
}

export function lastCallEmail(ctx: TemplateContext): EmailTemplate {
  const reply = ctx.founderEmail ?? 'support@getdeckle.dev';
  return {
    subject: 'Can I help you get Deckle working?',
    html: layout(
      `
      <p style="margin:0 0 16px 0;">Hey — I noticed you signed up for Deckle a week ago and haven't generated a PDF yet.</p>
      <p style="margin:0 0 16px 0;">That almost always means one of two things:</p>
      <ol style="margin:0 0 16px 20px;padding:0;color:#d1d5db;font-size:14px;line-height:1.8;">
        <li>You ran into a bug or confusing step.</li>
        <li>Deckle isn't quite the right fit for what you're building.</li>
      </ol>
      <p style="margin:0 0 16px 0;">Either way, I'd like to know. <strong>Just reply to this email</strong> and tell me what happened — even a one-liner helps. If there's a gap, I'll fix it this week.</p>
      <p style="margin:20px 0 0 0;color:#d1d5db;">— The Deckle team<br /><span style="color:#6b7280;font-size:12px;">Reply to: ${reply}</span></p>
    `,
      ctx,
    ),
  };
}

export function firstPdfEmail(ctx: TemplateContext): EmailTemplate {
  return {
    subject: 'You generated your first PDF — here is what is next',
    html: layout(
      `
      <h1 style="font-size:22px;font-weight:800;margin:0 0 12px 0;color:#FAFAFA;">🎉 First PDF: shipped.</h1>
      <p style="margin:0 0 16px 0;">Nice work. The hardest step is over — you've seen Deckle actually render a PDF. Here's what I'd do next:</p>
      <ol style="margin:0 0 20px 20px;padding:0;color:#d1d5db;font-size:14px;line-height:1.8;">
        <li><strong>Save a template.</strong> Turn the HTML you just rendered into a reusable template with <code>{{variables}}</code>, so your backend can call it with real data.</li>
        <li><strong>Install an SDK</strong> — TS / Python / Go / Ruby — and do your first real call from your code.</li>
        <li><strong>Wire a webhook.</strong> For async batch renders, point a webhook at your app so you don't have to poll.</li>
      </ol>
      <div style="margin:24px 0;">${button(ctx.dashboardUrl, 'Open your dashboard →')}</div>
      <p style="margin:20px 0 0 0;color:#6b7280;font-size:12px;">Stuck on any of the above? Reply and I'll jump in.</p>
    `,
      ctx,
    ),
  };
}

export function reengagementEmail(ctx: TemplateContext): EmailTemplate {
  return {
    subject: "We've shipped a lot since you last generated",
    html: layout(
      `
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px 0;color:#FAFAFA;">Welcome back — here's what's new.</h1>
      <p style="margin:0 0 16px 0;">Since you last generated a PDF, we've shipped:</p>
      <ul style="margin:0 0 20px 20px;padding:0;color:#d1d5db;font-size:14px;line-height:1.8;">
        <li>A bigger templates gallery (invoice, receipt, contract, NDA, event ticket, report card + more)</li>
        <li>PDF forms (fill, add fields, list fields)</li>
        <li>Password protection, digital signatures, PDF/A conversion</li>
        <li>A visual drag-and-drop template builder</li>
      </ul>
      <div style="margin:24px 0;">${button(ctx.marketplaceUrl, 'Browse the gallery →')}</div>
    `,
      ctx,
    ),
  };
}

export function buildTemplate(
  campaign:
    | 'welcome'
    | 'nudge1'
    | 'nudge2'
    | 'last_call'
    | 'first_pdf'
    | 'reengagement',
  ctx: TemplateContext,
): EmailTemplate {
  switch (campaign) {
    case 'welcome':
      return welcomeEmail(ctx);
    case 'nudge1':
      return nudge1Email(ctx);
    case 'nudge2':
      return nudge2Email(ctx);
    case 'last_call':
      return lastCallEmail(ctx);
    case 'first_pdf':
      return firstPdfEmail(ctx);
    case 'reengagement':
      return reengagementEmail(ctx);
  }
}
