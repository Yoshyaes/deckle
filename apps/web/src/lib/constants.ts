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
      'Merge, split, protect, sign, and fill forms. A complete PDF toolkit in one API.',
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
  html: `import DocuForge from 'docuforge';

const client = new DocuForge('df_live_...');

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

console.log(pdf.url); // https://cdn.docuforge.dev/gen_abc123.pdf`,

  react: `import DocuForge from 'docuforge';
import { Document, Page, Table } from '@docuforge/react-pdf';

const client = new DocuForge('df_live_...');

const pdf = await client.fromReact({
  component: \`
    <Document title="Monthly Report">
      <Page size="A4" margin="20mm">
        <h1 style={{ fontSize: 24 }}>Monthly Report</h1>
        <Table
          data={data}
          columns={[
            { key: 'name', header: 'Product' },
            { key: 'revenue', header: 'Revenue', align: 'right' },
          ]}
          striped
        />
      </Page>
    </Document>
  \`
});

console.log(pdf.url);`,

  template: `import DocuForge from 'docuforge';

const client = new DocuForge('df_live_...');

// Use a stored template with dynamic data
const pdf = await client.fromTemplate({
  templateId: 'tmpl_invoice_v2',
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

  curl: `curl -X POST https://api.docuforge.dev/v1/generate \\
  -H "Authorization: Bearer df_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "html": "<h1>Hello from DocuForge</h1><p>This is a PDF.</p>",
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
#   "url": "https://cdn.docuforge.dev/gen_abc123.pdf",
#   "pages": 1,
#   "file_size": 24531,
#   "generation_time_ms": 342
# }`,
};

export const sdks = [
  { name: 'TypeScript', package: 'npm i docuforge', color: '#3178C6' },
  { name: 'Python', package: 'pip install docuforge', color: '#3776AB' },
  { name: 'Go', package: 'go get github.com/docuforge/docuforge-go', color: '#00ADD8' },
  { name: 'Ruby', package: 'gem install docuforge', color: '#CC342D' },
  { name: 'React', package: 'npm i @docuforge/react-pdf', color: '#61DAFB' },
];

export const comparisonRows = [
  { feature: 'Setup Time', docuforge: '30 seconds', puppeteer: '30+ minutes', wkhtmltopdf: '15 minutes', prince: '1 hour' },
  { feature: 'Maintenance', docuforge: 'Zero', puppeteer: 'High (browser updates)', wkhtmltopdf: 'Medium', prince: 'Low' },
  { feature: 'React Support', docuforge: 'Yes', puppeteer: 'Manual', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'Template Engine', docuforge: 'Built-in', puppeteer: 'DIY', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'Batch Processing', docuforge: 'Built-in queue', puppeteer: 'DIY', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'PDF Tools (merge, split)', docuforge: 'Yes', puppeteer: 'No', wkhtmltopdf: 'No', prince: 'No' },
  { feature: 'Multi-language SDKs', docuforge: '5 languages', puppeteer: 'JS only', wkhtmltopdf: 'CLI', prince: 'CLI + Java' },
  { feature: 'Self-hostable', docuforge: 'Yes', puppeteer: 'Yes', wkhtmltopdf: 'Yes', prince: 'Yes' },
];

export const testimonials = [
  {
    quote:
      'DocuForge replaced 200 lines of Puppeteer boilerplate with a single API call. Our invoice generation went from a maintenance nightmare to something we never think about.',
    name: 'Sarah Chen',
    title: 'CTO',
    company: 'InvoiceStack',
  },
  {
    quote:
      'We switched from wkhtmltopdf and the difference in output quality is night and day. The template versioning means we can iterate on designs without breaking production.',
    name: 'Marcus Rodriguez',
    title: 'Senior Engineer',
    company: 'ReportLab',
  },
  {
    quote:
      'The React-to-PDF feature is a game changer. We reuse our existing UI components and get pixel-perfect PDFs without maintaining separate templates.',
    name: 'Priya Sharma',
    title: 'Full-Stack Developer',
    company: 'CourseHub',
  },
];
