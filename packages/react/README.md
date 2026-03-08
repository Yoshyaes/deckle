# @docuforge/react-pdf

React components for building pixel-perfect PDF documents with [DocuForge](https://docuforge.dev).

Compose documents using familiar React patterns — pages, headers, footers, tables, grids, watermarks, barcodes, and signatures — then send them to the DocuForge API to generate production-ready PDFs.

## Installation

```bash
npm install @docuforge/react-pdf
```

```bash
pnpm add @docuforge/react-pdf
```

```bash
yarn add @docuforge/react-pdf
```

> **Peer dependency:** React 18 or later is required.

## Quick Start

```tsx
import { Document, Page, Header, Footer } from '@docuforge/react-pdf';

export default function MyDocument() {
  return (
    <Document title="Hello World">
      <Page size="A4" margin="1in">
        <Header>
          <h1>My First PDF</h1>
        </Header>
        <p>This will be rendered as a pixel-perfect PDF.</p>
        <Footer>
          <span>Generated with DocuForge</span>
        </Footer>
      </Page>
    </Document>
  );
}
```

## Components

### `<Document>`

Root wrapper for the entire PDF. Renders a full HTML structure (`<html>`, `<head>`, `<body>`) that the DocuForge API converts to PDF.

```tsx
<Document title="Invoice #1234" styles={`
  h1 { color: #1a1a1a; }
  .highlight { background: #fef3c7; }
`}>
  {/* Pages go here */}
</Document>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | *required* | Page components and content |
| `title` | `string` | — | Document title (`<title>` tag) |
| `styles` | `string` | — | Custom CSS injected into `<style>` |

---

### `<Page>`

Represents a single page in the PDF. Each `<Page>` component maps to exactly one printed page.

```tsx
<Page size="Letter" orientation="landscape" margin="0.75in">
  <h1>Landscape Letter page</h1>
</Page>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | *required* | Page content |
| `size` | `"A4" \| "Letter" \| "Legal"` | `"A4"` | Paper size |
| `orientation` | `"portrait" \| "landscape"` | `"portrait"` | Page orientation |
| `margin` | `string` | `"20mm"` | CSS margin (e.g. `"1in"`, `"20mm 15mm"`) |
| `style` | `CSSProperties` | — | Additional inline styles |

**Page Dimensions:**

| Size | Portrait | Landscape |
|------|----------|-----------|
| A4 | 210mm x 297mm | 297mm x 210mm |
| Letter | 8.5in x 11in | 11in x 8.5in |
| Legal | 8.5in x 14in | 14in x 8.5in |

---

### `<Header>`

Styled header area with a bottom border. Place at the top of a `<Page>`.

```tsx
<Header>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <strong>Acme Corp</strong>
    <span>Invoice #1234</span>
  </div>
</Header>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | *required* | Header content |
| `style` | `CSSProperties` | — | Additional inline styles |

---

### `<Footer>`

Page footer that sticks to the bottom using absolute positioning. Place inside a `<Page>`.

```tsx
<Footer>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span>Confidential</span>
    <span>Page 1 of 3</span>
  </div>
</Footer>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | *required* | Footer content |
| `style` | `CSSProperties` | — | Additional inline styles |

> **Note:** The Footer is positioned absolutely at `bottom: 20mm` within the page. Make sure your page has `position: relative` (this is set by `<Page>` automatically).

---

### `<Table>`

Data table with configurable columns, optional striped rows, and custom cell renderers.

```tsx
const invoiceItems = [
  { description: 'Consulting', qty: 10, rate: 150, total: 1500 },
  { description: 'Development', qty: 20, rate: 200, total: 4000 },
];

<Table
  data={invoiceItems}
  columns={[
    { key: 'description', header: 'Description', width: '40%' },
    { key: 'qty', header: 'Qty', align: 'center' },
    { key: 'rate', header: 'Rate', align: 'right', render: (v) => `$${v}` },
    { key: 'total', header: 'Total', align: 'right', render: (v) => `$${v.toLocaleString()}` },
  ]}
  striped
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | *required* | Array of row objects |
| `columns` | `Column<T>[]` | *required* | Column definitions (see below) |
| `striped` | `boolean` | `false` | Alternate row background colors |
| `bordered` | `boolean` | `true` | Show cell borders |
| `style` | `CSSProperties` | — | Additional inline styles on `<table>` |

**Column definition:**

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Property name to read from each row |
| `header` | `string` | Column header text |
| `width` | `string` | CSS width (e.g. `"200px"`, `"30%"`) |
| `align` | `"left" \| "center" \| "right"` | Text alignment |
| `render` | `(value, row) => ReactNode` | Custom cell renderer |

---

### `<Grid>`

CSS Grid layout for placing content side-by-side.

```tsx
<Grid columns={3} gap="24px">
  <div>
    <strong>Bill To</strong>
    <p>John Doe<br />123 Main St</p>
  </div>
  <div>
    <strong>Ship To</strong>
    <p>Jane Doe<br />456 Oak Ave</p>
  </div>
  <div>
    <strong>Invoice Details</strong>
    <p>Date: 2024-01-15<br />Due: 2024-02-15</p>
  </div>
</Grid>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | *required* | Grid items |
| `columns` | `number` | `2` | Number of equal-width columns |
| `gap` | `string` | `"16px"` | Gap between cells |
| `style` | `CSSProperties` | — | Additional inline styles |

---

### `<Watermark>`

Semi-transparent text overlay for marking documents as drafts, confidential, etc.

```tsx
<Page>
  <Watermark text="DRAFT" color="#ff0000" opacity={0.1} />
  <p>Document content here...</p>
</Page>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | *required* | Watermark text |
| `color` | `string` | `"#000000"` | Text color |
| `opacity` | `number` | `0.08` | Opacity (0 to 1) |
| `angle` | `number` | `-45` | Rotation in degrees |
| `fontSize` | `number` | `72` | Font size in pixels |

---

### `<Barcode>`

Renders a placeholder that the DocuForge API replaces with an actual QR code or barcode SVG during PDF generation.

```tsx
{/* QR Code */}
<Barcode value="https://example.com/invoice/1234" type="qr" />

{/* Linear Barcode */}
<Barcode value="SKU-12345" type="barcode" width={250} height={60} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | *required* | Data to encode |
| `type` | `"qr" \| "barcode"` | `"qr"` | Code type |
| `width` | `number` | `150` (qr) / `200` (barcode) | Width in pixels |
| `height` | `number` | `150` (qr) / `80` (barcode) | Height in pixels |

---

### `<Signature>`

Signature line with a label, commonly used for contracts and official documents.

```tsx
<Grid columns={2} gap="48px">
  <Signature label="Client Signature" />
  <Signature label="Authorized Representative" width="300px" />
</Grid>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `"Signature"` | Label below the line |
| `width` | `string` | `"250px"` | Width of the signature line |
| `style` | `CSSProperties` | — | Additional inline styles |

---

## Full Example: Invoice

```tsx
import {
  Document,
  Page,
  Header,
  Footer,
  Table,
  Grid,
  Watermark,
  Barcode,
  Signature,
} from '@docuforge/react-pdf';

interface InvoiceProps {
  data: {
    number: string;
    date: string;
    dueDate: string;
    company: string;
    client: { name: string; address: string; email: string };
    items: { description: string; qty: number; rate: number; total: number }[];
    subtotal: number;
    tax: number;
    total: number;
    isDraft?: boolean;
  };
}

export default function Invoice({ data }: InvoiceProps) {
  return (
    <Document title={`Invoice ${data.number}`} styles={`
      h1 { margin: 0 0 4px; font-size: 28px; }
      .text-muted { color: #6b7280; font-size: 12px; }
      .text-right { text-align: right; }
      .total-row { font-size: 18px; font-weight: 700; margin-top: 16px; }
    `}>
      <Page size="A4" margin="25mm">
        {data.isDraft && <Watermark text="DRAFT" />}

        <Header>
          <Grid columns={2}>
            <div>
              <h1>{data.company}</h1>
              <p className="text-muted">Invoice {data.number}</p>
            </div>
            <div className="text-right">
              <Barcode value={`https://pay.example.com/${data.number}`} type="qr" width={80} height={80} />
            </div>
          </Grid>
        </Header>

        <Grid columns={2} gap="32px">
          <div>
            <strong>Bill To</strong>
            <p>{data.client.name}<br />{data.client.address}<br />{data.client.email}</p>
          </div>
          <div className="text-right">
            <p><strong>Date:</strong> {data.date}</p>
            <p><strong>Due:</strong> {data.dueDate}</p>
          </div>
        </Grid>

        <div style={{ marginTop: '32px' }}>
          <Table
            data={data.items}
            columns={[
              { key: 'description', header: 'Description', width: '45%' },
              { key: 'qty', header: 'Qty', align: 'center' },
              { key: 'rate', header: 'Rate', align: 'right', render: (v) => `$${v.toFixed(2)}` },
              { key: 'total', header: 'Total', align: 'right', render: (v) => `$${v.toFixed(2)}` },
            ]}
            striped
          />
        </div>

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <p>Subtotal: ${data.subtotal.toFixed(2)}</p>
          <p>Tax: ${data.tax.toFixed(2)}</p>
          <p className="total-row">Total: ${data.total.toFixed(2)}</p>
        </div>

        <div style={{ marginTop: '48px' }}>
          <Signature label="Authorized Signature" />
        </div>

        <Footer>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Thank you for your business</span>
            <span>{data.company}</span>
          </div>
        </Footer>
      </Page>
    </Document>
  );
}
```

## Usage with DocuForge API

Components render to HTML that the DocuForge API converts to PDF via a headless browser. Here's the full workflow:

### With the TypeScript SDK

```typescript
import { DocuForge } from 'docuforge';

const df = new DocuForge('df_live_...');

// Send a React component as a string
const pdf = await df.fromReact({
  react: `
    import { Document, Page, Header } from '@docuforge/react-pdf';

    export default function Report({ data }) {
      return (
        <Document title="Monthly Report">
          <Page>
            <Header><h1>{data.title}</h1></Header>
            <p>Generated on {data.date}</p>
          </Page>
        </Document>
      );
    }
  `,
  data: { title: 'March Report', date: '2024-03-01' },
  options: { format: 'A4' },
});

console.log(pdf.url); // https://cdn.docuforge.dev/gen_abc123.pdf
```

### With the REST API directly

```bash
curl -X POST https://api.docuforge.dev/v1/generate \
  -H "Authorization: Bearer df_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "react": "import { Document, Page } from \"@docuforge/react-pdf\";\nexport default function Doc() { return <Document><Page><h1>Hello</h1></Page></Document>; }",
    "options": { "format": "A4" }
  }'
```

## How It Works

```
React Components ──(renderToStaticMarkup)──> HTML ──(Playwright)──> PDF
```

1. You compose a document using `@docuforge/react-pdf` components
2. The DocuForge API transpiles your JSX and renders it to static HTML via `ReactDOMServer.renderToStaticMarkup()`
3. Playwright (headless Chromium) converts the HTML to a pixel-perfect PDF
4. Special placeholders like `{{qr:...}}` and `{{barcode:...}}` are replaced with SVG images before rendering

The components themselves are lightweight React components that output semantic HTML with inline styles optimized for print.

## TypeScript

All components are fully typed. Import types alongside components:

```typescript
import type {
  DocumentProps,
  PageProps,
  PageSize,
  PageOrientation,
  HeaderProps,
  FooterProps,
  TableProps,
  Column,
  GridProps,
  WatermarkProps,
  BarcodeProps,
  SignatureProps,
} from '@docuforge/react-pdf';
```

## License

MIT
