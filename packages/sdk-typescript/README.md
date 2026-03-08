# DocuForge

PDF generation API for developers. HTML in, pixel-perfect PDF out.

## Installation

```bash
npm install docuforge
```

## Quick Start

```typescript
import { DocuForge } from 'docuforge';

const df = new DocuForge('df_live_...');

// Generate a PDF from HTML
const pdf = await df.generate({
  html: '<h1>Invoice #1234</h1><p>Amount: $500</p>',
  options: { format: 'A4', margin: '1in' }
});

console.log(pdf.url);    // https://cdn.docuforge.dev/gen_abc123.pdf
console.log(pdf.pages);  // 2
```

## Generate from Template

```typescript
const pdf = await df.fromTemplate({
  template: 'tmpl_invoice_v2',
  data: {
    company: 'Acme Corp',
    items: [
      { description: 'Consulting', qty: 10, rate: 150 }
    ],
    total: 1500
  }
});
```

## PDF Options

```typescript
const pdf = await df.generate({
  html: invoiceHTML,
  options: {
    format: 'A4',              // A4, Letter, Legal, or { width, height }
    margin: '1in',             // string or { top, right, bottom, left }
    orientation: 'portrait',   // portrait or landscape
    header: '<div>Acme Corp</div>',
    footer: '<div>Page {{pageNumber}} of {{totalPages}}</div>',
    printBackground: true
  }
});
```

## Templates

```typescript
// Create a template
const template = await df.templates.create({
  name: 'Invoice',
  html_content: '<h1>Invoice for {{company}}</h1><p>Total: {{total}}</p>',
  schema: { company: 'string', total: 'number' }
});

// List templates
const { data } = await df.templates.list();

// Update a template
await df.templates.update('tmpl_abc123', {
  html_content: '<h1>Updated Invoice for {{company}}</h1>'
});

// Delete a template
await df.templates.delete('tmpl_abc123');
```

## Usage Stats

```typescript
const usage = await df.getUsage();
console.log(`${usage.generation_count} / ${usage.limit} PDFs used this month`);
```

## Base64 Output

```typescript
const pdf = await df.generate({
  html: '<h1>Hello</h1>',
  output: 'base64'
});

// pdf.data contains base64-encoded PDF
```

## Error Handling

```typescript
import { DocuForge, DocuForgeError, RateLimitError } from 'docuforge';

try {
  const pdf = await df.generate({ html: '<h1>Hello</h1>' });
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`);
  } else if (err instanceof DocuForgeError) {
    console.log(`Error ${err.code}: ${err.message}`);
  }
}
```

## Configuration

```typescript
const df = new DocuForge('df_live_...', {
  baseUrl: 'https://api.docuforge.dev', // Custom API URL
  timeout: 30000                         // Request timeout in ms
});
```

## License

MIT
