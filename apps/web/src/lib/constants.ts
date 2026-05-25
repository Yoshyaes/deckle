import {
  Code2,
  Layers,
  Zap,
  Wrench,
  QrCode,
  FileText,
  Cloud,
  Server,
} from 'lucide-react';

export const features = [
  {
    icon: Code2,
    title: 'HTML & React Rendering',
    description:
      'Send raw HTML or React JSX. Playwright renders it with pixel-perfect fidelity, just like a browser.',
  },
  {
    icon: Layers,
    title: 'Template Engine',
    description:
      'Handlebars templates with variables, loops, and conditionals. Store and version them via API.',
  },
  {
    icon: Zap,
    title: 'Batch Generation',
    description:
      'Generate hundreds of PDFs asynchronously. Queue-based processing with webhook callbacks.',
  },
  {
    icon: Wrench,
    title: 'PDF Tools',
    description:
      'Merge, split, fill forms, add visual signature annotations, and convert to PDF/A. One API for the full PDF workflow.',
  },
  {
    icon: QrCode,
    title: 'QR Codes & Barcodes',
    description:
      'Drop {{qr:data}} or {{barcode:data}} placeholders in your HTML. We render inline SVGs automatically.',
  },
  {
    icon: FileText,
    title: 'Headers & Footers',
    description:
      'Dynamic page numbers, dates, and custom content in headers and footers across every page.',
  },
  {
    icon: Cloud,
    title: 'Multi-Cloud Storage',
    description:
      'Store generated PDFs in Cloudflare R2, AWS S3, or Google Cloud Storage. Your choice.',
  },
  {
    icon: Server,
    title: 'Self-Hostable',
    description:
      'Run the entire stack on your own infrastructure with Docker Compose. Full control, zero vendor lock-in.',
  },
];

export const codeExamples = {
  html: `import { Deckle } from '@getdeckle/sdk';

const client = new Deckle(process.env.DECKLE_API_KEY!);

const pdf = await client.generate({
  html: \`
    <h1>Invoice #1042</h1>
    <p>Billed to: Acme Corp</p>
    <table>
      <tr><td>Widget Pro</td><td>$49.99</td></tr>
      <tr><td>Support Plan</td><td>$19.99</td></tr>
    </table>
    <p><strong>Total: $69.98</strong></p>
  \`,
  options: { format: 'A4', margin: '20mm' }
});

console.log(pdf.url); // https://cdn.getdeckle.dev/gen_abc123.pdf`,

  react: `import { Deckle } from '@getdeckle/sdk';

const client = new Deckle(process.env.DECKLE_API_KEY!);

// Pass a JSX string with a default export. Props arrive via \`data\`.
const pdf = await client.fromReact({
  react: \`
    export default function Report({ title, rows }) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
          <h1>{title}</h1>
          <table>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td style={{ textAlign: 'right' }}>{r.revenue}</td>
              </tr>
            ))}
          </table>
        </div>
      );
    }
  \`,
  data: {
    title: 'Monthly Report',
    rows: [
      { name: 'Widget Pro', revenue: '$49,990' },
      { name: 'Support Plan', revenue: '$19,990' },
    ],
  },
  options: { format: 'A4' }
});

console.log(pdf.url);`,

  template: `import { Deckle } from '@getdeckle/sdk';

const client = new Deckle(process.env.DECKLE_API_KEY!);

// Use a stored template with dynamic data
const pdf = await client.fromTemplate({
  template: 'tmpl_invoice_v2',
  data: {
    customerName: 'Acme Corp',
    items: [
      { name: 'Widget Pro', price: 49.99 },
      { name: 'Support Plan', price: 19.99 },
    ],
    total: 69.98,
    date: '2026-03-07',
  }
});

console.log(pdf.url);`,

  curl: `curl -X POST https://api.getdeckle.dev/v1/generate \\
  -H "Authorization: Bearer dk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "html": "<h1>Hello from Deckle</h1><p>This is a PDF.</p>",
    "options": {
      "format": "A4",
      "margin": "20mm",
      "printBackground": true
    }
  }'

# Response:
# {
#   "id": "gen_abc123",
#   "status": "completed",
#   "url": "https://cdn.getdeckle.dev/gen_abc123.pdf",
#   "pages": 1,
#   "file_size": 24531,
#   "generation_time_ms": 342
# }`,
};

export const sdks = [
  { name: 'TypeScript', package: 'npm i @getdeckle/sdk', color: '#3178C6' },
  { name: 'Python', package: 'pip install deckle', color: '#3776AB' },
  { name: 'Go', package: 'go get github.com/Yoshyaes/deckle/packages/sdk-go', color: '#00ADD8' },
  { name: 'Ruby', package: 'gem install deckle', color: '#CC342D' },
  { name: 'React', package: 'npm i @getdeckle/react-pdf', color: '#61DAFB' },
];

export const comparisonRows = [
  { feature: 'Setup Time', deckle: '5 minutes', puppeteer: '30+ minutes', wkhtmltopdf: '15 minutes', prince: '1 hour' },
  { feature: 'Maintenance', deckle: 'Zero', puppeteer: 'High (browser updates)', wkhtmltopdf: 'Medium', prince: 'Low' },
  { feature: 'React Support', deckle: 'Yes', puppeteer: 'Manual', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'Template Engine', deckle: 'Built-in', puppeteer: 'DIY', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'Batch Processing', deckle: 'Built-in queue', puppeteer: 'DIY', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'PDF Tools (merge, split)', deckle: 'Yes', puppeteer: 'No', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'Multi-language SDKs', deckle: 'TS, Python, Go, Ruby', puppeteer: 'JS only', wkhtmltopdf: 'CLI', prince: 'CLI + Java' },
  { feature: 'Self-hostable', deckle: 'Yes', puppeteer: 'Yes', wkhtmltopdf: 'Yes', prince: 'Yes' },
];

export const testimonials: Array<{
  quote: string;
  name: string;
  title: string;
  company: string;
}> = [];
