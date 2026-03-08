import { useState } from "react";

const VIEWS = { LIBRARY: "library", PRODUCT: "product", DASHBOARD: "dashboard", DOCS: "docs" };

const colors = {
  bg: "#0A0A0B", surface: "#111113", surfaceHover: "#18181B",
  border: "#27272A", borderSubtle: "#1E1E21",
  text: "#FAFAFA", textMuted: "#71717A", textDim: "#52525B",
  accent: "#F97316", accentGlow: "rgba(249,115,22,0.15)", accentSoft: "rgba(249,115,22,0.08)",
  green: "#22C55E", blue: "#3B82F6", purple: "#A855F7", red: "#EF4444",
};

// Build package names dynamically so the renderer doesn't try to resolve them
const PKG = ["docu","forge"].join("");
const PKG_REACT = ["@docu","forge/","react-pdf"].join("");
const IM = ["imp","ort"].join("");

const Badge = ({ children, color = colors.accent }) => (
  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color, background: color === colors.accent ? colors.accentSoft : `${color}11`, border: `1px solid ${color}33` }}>{children}</span>
);

const CodeBlock = ({ code, title, compact = false }) => (
  <div style={{ background: "#0D0D0F", border: `1px solid ${colors.border}`, borderRadius: "12px", overflow: "hidden", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace" }}>
    {title && (
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EAB308" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E" }} />
        </div>
        <span style={{ fontSize: "12px", color: colors.textDim, marginLeft: "4px" }}>{title}</span>
      </div>
    )}
    <pre style={{ margin: 0, padding: compact ? "14px 16px" : "20px 24px", fontSize: compact ? "12px" : "13px", lineHeight: 1.7, overflowX: "auto", color: colors.textMuted }}>
      <code>{code}</code>
    </pre>
  </div>
);

const GlowButton = ({ children, primary = false, small = false, onClick, icon }) => (
  <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: small ? "8px 16px" : "12px 24px", borderRadius: "10px", border: primary ? "none" : `1px solid ${colors.border}`, background: primary ? `linear-gradient(135deg, ${colors.accent}, #EA580C)` : "transparent", color: primary ? "#fff" : colors.text, fontSize: small ? "13px" : "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: primary ? `0 0 30px ${colors.accentGlow}` : "none" }}>
    {icon && <span style={{ fontSize: small ? "14px" : "16px" }}>{icon}</span>}
    {children}
  </button>
);

const StatCard = ({ value, label, trend }) => (
  <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "14px", padding: "20px 24px", flex: 1, minWidth: "140px" }}>
    <div style={{ fontSize: "12px", color: colors.textDim, marginBottom: "8px", fontWeight: 500 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
      <span style={{ fontSize: "28px", fontWeight: 700, color: colors.text, letterSpacing: "-1px" }}>{value}</span>
      {trend && <span style={{ fontSize: "12px", color: colors.green, fontWeight: 600 }}>{trend}</span>}
    </div>
  </div>
);

const TopNav = ({ currentView, setCurrentView }) => (
  <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,10,11,0.85)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${colors.borderSubtle}`, padding: "0 32px" }}>
    <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "56px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: 24, height: 24, borderRadius: "6px", background: `linear-gradient(135deg, ${colors.accent}, #EA580C)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: "#fff" }}>D</div>
          <span style={{ fontSize: "15px", fontWeight: 700, color: colors.text, letterSpacing: "-0.3px" }}>DocuForge</span>
        </div>
        <div style={{ display: "flex", background: colors.surface, borderRadius: "8px", padding: "3px", border: `1px solid ${colors.borderSubtle}` }}>
          {[{ id: VIEWS.LIBRARY, label: "Component Library" }, { id: VIEWS.PRODUCT, label: "Product Landing" }, { id: VIEWS.DASHBOARD, label: "Dashboard" }, { id: VIEWS.DOCS, label: "Docs" }].map(tab => (
            <button key={tab.id} onClick={() => setCurrentView(tab.id)} style={{ padding: "5px 14px", borderRadius: "6px", border: "none", background: currentView === tab.id ? colors.surfaceHover : "transparent", color: currentView === tab.id ? colors.text : colors.textDim, fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{tab.label}</button>
          ))}
        </div>
      </div>
      <Badge>Mockup</Badge>
    </div>
  </nav>
);

// ─── VIEW 1: COMPONENT LIBRARY ───
const ComponentLibraryView = () => {
  const [sel, setSel] = useState("Invoice");
  const comps = [
    { name: "Invoice", icon: "\u{1F4C4}", desc: "Full invoice layout with line items" },
    { name: "Table", icon: "\u{1F4CA}", desc: "Auto-paginating data tables" },
    { name: "Header", icon: "\u{1F51D}", desc: "Repeating page headers" },
    { name: "Footer", icon: "\u{1F53B}", desc: "Page numbers & footers" },
    { name: "Chart", icon: "\u{1F4C8}", desc: "SVG charts for PDF rendering" },
    { name: "PageBreak", icon: "\u2702\uFE0F", desc: "Controlled page breaks" },
    { name: "Signature", icon: "\u270D\uFE0F", desc: "Signature block with date" },
    { name: "Watermark", icon: "\u{1F4A7}", desc: "Overlay watermark text" },
  ];

  const codes = {
    Invoice: `${IM} { Invoice, InvoiceHeader, LineItem,
  InvoiceTotal } from '${PKG_REACT}';

export const MyInvoice = ({ data }) => (
  <Invoice>
    <InvoiceHeader
      logo="/logo.svg"
      company="Acme Corp"
      invoiceNumber={data.number}
      date={data.date}
      dueDate={data.dueDate}
    />
    {data.items.map(item => (
      <LineItem
        key={item.id}
        description={item.description}
        quantity={item.qty}
        rate={item.rate}
        amount={item.qty * item.rate}
      />
    ))}
    <InvoiceTotal
      subtotal={data.subtotal}
      tax={data.tax}
      total={data.total}
    />
  </Invoice>
);`,
    Table: `${IM} { Table, TableHeader, TableRow,
  TableCell } from '${PKG_REACT}';

export const DataReport = ({ rows }) => (
  <Table
    paginate          // Auto-splits across pages
    repeatHeader      // Header on every page
    striped           // Alternating row colors
  >
    <TableHeader>
      <TableCell width="40%">Description</TableCell>
      <TableCell width="20%">Quantity</TableCell>
      <TableCell width="20%">Rate</TableCell>
      <TableCell width="20%" align="right">Amount</TableCell>
    </TableHeader>
    {rows.map(row => (
      <TableRow key={row.id}>
        <TableCell>{row.desc}</TableCell>
        <TableCell>{row.qty}</TableCell>
        <TableCell>{formatCurrency(row.rate)}</TableCell>
        <TableCell align="right">
          {formatCurrency(row.total)}
        </TableCell>
      </TableRow>
    ))}
  </Table>
);`,
    Header: `${IM} { PageHeader } from '${PKG_REACT}';

// Repeats on every page automatically
export const ReportHeader = () => (
  <PageHeader>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between'
    }}>
      <img src="/logo.svg" height={24} />
      <span style={{ color: '#666', fontSize: 10 }}>
        Confidential
      </span>
    </div>
  </PageHeader>
);`,
    Footer: `${IM} { PageFooter, PageNumber } from '${PKG_REACT}';

export const ReportFooter = () => (
  <PageFooter>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 10, color: '#999'
    }}>
      <span>Acme Corp - Confidential</span>
      <PageNumber format="Page {current} of {total}" />
    </div>
  </PageFooter>
);`,
    Chart: `${IM} { BarChart, Bar, Axis } from '${PKG_REACT}';

export const RevenueChart = ({ data }) => (
  <BarChart data={data} width={500} height={250}>
    <Axis type="x" dataKey="month" />
    <Axis type="y" label="Revenue ($)" />
    <Bar dataKey="revenue" fill="#F97316" />
    <Bar dataKey="expenses" fill="#71717A" />
  </BarChart>
);`,
    PageBreak: `${IM} { PageBreak } from '${PKG_REACT}';

export const MultiSectionReport = () => (
  <div>
    <section>
      <h1>Executive Summary</h1>
      <p>...</p>
    </section>

    <PageBreak />

    <section>
      <h1>Financial Details</h1>
      <p>...</p>
    </section>
  </div>
);`,
    Signature: `${IM} { SignatureBlock } from '${PKG_REACT}';

export const ContractFooter = ({ signer }) => (
  <SignatureBlock
    name={signer.name}
    title={signer.title}
    date={signer.date}
    showLine={true}
    lineWidth={200}
  />
);`,
    Watermark: `${IM} { Watermark } from '${PKG_REACT}';

export const DraftDocument = ({ children }) => (
  <div>
    <Watermark
      text="DRAFT"
      opacity={0.08}
      angle={-45}
      fontSize={72}
      color="#000"
    />
    {children}
  </div>
);`,
  };

  const invoicePreview = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <div style={{ width: 36, height: 36, borderRadius: "8px", background: `linear-gradient(135deg, ${colors.accent}, #EA580C)`, marginBottom: "8px" }} />
          <div style={{ fontWeight: 700, fontSize: "14px" }}>Acme Corp</div>
          <div style={{ fontSize: "11px", color: "#666" }}>123 Main St, SF CA 94102</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>INVOICE</div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>#INV-2026-0042</div>
          <div style={{ fontSize: "11px", color: "#666" }}>Feb 24, 2026</div>
        </div>
      </div>
      <div style={{ background: "#F9FAFB", borderRadius: "6px", padding: "12px 16px", marginBottom: "24px", fontSize: "12px" }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Bill To</div>
        <div style={{ color: "#666" }}>TechStartup Inc \u00b7 456 Market St, SF CA</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
            {["Description", "Qty", "Rate", "Amount"].map((h, i) => (
              <th key={h} style={{ textAlign: i >= 1 ? (i === 3 ? "right" : "center") : "left", padding: "8px 0", fontWeight: 600, color: "#374151" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[{ d: "Product Consulting", q: 40, r: 150 }, { d: "UI/UX Design", q: 24, r: 125 }, { d: "Development Sprint", q: 80, r: 175 }].map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
              <td style={{ padding: "10px 0", color: "#374151" }}>{item.d}</td>
              <td style={{ padding: "10px 0", textAlign: "center", color: "#6B7280" }}>{item.q}</td>
              <td style={{ padding: "10px 0", textAlign: "center", color: "#6B7280" }}>${item.r}.00</td>
              <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 600, color: "#374151" }}>${(item.q * item.r).toLocaleString()}.00</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", paddingTop: "16px", borderTop: "2px solid #111" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "11px", color: "#6B7280", marginBottom: "2px" }}>Total Due</div>
          <div style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-1px" }}>$23,000.00</div>
        </div>
      </div>
    </div>
  );

  const tablePreview = (
    <div>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Q4 Sales Report</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead><tr style={{ background: "#F3F4F6" }}>
          {["Product", "Units", "Revenue", "Growth"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#6B7280" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {[{ p: "Enterprise Plan", u: "1,247", r: "$2.4M", g: "+34%" }, { p: "Pro Plan", u: "8,432", r: "$1.1M", g: "+22%" }, { p: "Starter Plan", u: "24,891", r: "$498K", g: "+67%" }, { p: "Add-ons", u: "5,120", r: "$256K", g: "+12%" }].map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 ? "#FAFAFA" : "#fff" }}>
              <td style={{ padding: "10px 12px", fontWeight: 500 }}>{row.p}</td>
              <td style={{ padding: "10px 12px", color: "#6B7280" }}>{row.u}</td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.r}</td>
              <td style={{ padding: "10px 12px", color: "#16A34A", fontWeight: 600 }}>{row.g}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: "12px", fontSize: "10px", color: "#9CA3AF", textAlign: "center", fontStyle: "italic" }}>Page 1 of 3 \u2014 Table auto-paginates with repeating headers</div>
    </div>
  );

  const previews = {
    Invoice: invoicePreview,
    Table: tablePreview,
    Header: (<div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", paddingBottom: "12px", marginBottom: "24px" }}><div style={{ width: 80, height: 24, borderRadius: "4px", background: `linear-gradient(135deg, ${colors.accent}, #EA580C)` }} /><span style={{ fontSize: "10px", color: "#999", fontStyle: "italic" }}>Confidential</span></div><div style={{ fontSize: "10px", color: "#bbb", textAlign: "center", padding: "40px 0" }}>Header repeats on every page automatically</div></div>),
    Footer: (<div><div style={{ fontSize: "10px", color: "#bbb", textAlign: "center", padding: "40px 0 60px" }}>(page content)</div><div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #E5E7EB", paddingTop: "12px" }}><span style={{ fontSize: "10px", color: "#999" }}>Acme Corp - Confidential</span><span style={{ fontSize: "10px", color: "#999" }}>Page 1 of 5</span></div></div>),
    Chart: (<div><div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px" }}>Monthly Revenue</div><div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "120px" }}>{[45,52,38,65,72,58,82,90,75,95,88,102].map((h, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}><div style={{ width: "100%", maxWidth: 28, height: `${(h/102)*100}%`, borderRadius: "3px 3px 0 0", background: i >= 10 ? colors.accent : `${colors.accent}77` }} /><span style={{ fontSize: "8px", color: "#999" }}>{"JFMAMJJASOND"[i]}</span></div>)}</div></div>),
    PageBreak: (<div><div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>Executive Summary</div><div style={{ fontSize: "11px", color: "#666", lineHeight: 1.6, marginBottom: "20px" }}>This section covers the key findings from our Q4 analysis...</div><div style={{ borderTop: "2px dashed #D1D5DB", margin: "16px 0", position: "relative" }}><span style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 12px", fontSize: "10px", color: "#999" }}>{"\u2702"} Page Break</span></div><div style={{ fontSize: "14px", fontWeight: 700, marginTop: "24px", marginBottom: "8px" }}>Financial Details</div><div style={{ fontSize: "11px", color: "#666", lineHeight: 1.6 }}>The detailed financial breakdown starts on this new page...</div></div>),
    Signature: (<div style={{ paddingTop: "40px" }}><div style={{ width: 200 }}><div style={{ borderBottom: "1px solid #111", marginBottom: "8px", height: "40px" }} /><div style={{ fontSize: "12px", fontWeight: 600 }}>Jane Smith</div><div style={{ fontSize: "10px", color: "#666" }}>Chief Executive Officer</div><div style={{ fontSize: "10px", color: "#999", marginTop: "4px" }}>Date: Feb 24, 2026</div></div></div>),
    Watermark: (<div style={{ position: "relative", minHeight: "140px" }}><div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-45deg)", fontSize: "64px", fontWeight: 800, color: "rgba(0,0,0,0.06)", letterSpacing: "8px", whiteSpace: "nowrap" }}>DRAFT</div><div style={{ position: "relative", fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>Project Proposal</div><div style={{ position: "relative", fontSize: "11px", color: "#666", lineHeight: 1.6 }}>This document outlines the proposed scope of work for the upcoming quarter, including resource allocation, timeline, and deliverables...</div></div>),
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <section style={{ padding: "80px 32px 60px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${colors.border}22 1px, transparent 1px), linear-gradient(90deg, ${colors.border}22 1px, transparent 1px)`, backgroundSize: "60px 60px", mask: "radial-gradient(ellipse at center, black 30%, transparent 70%)", WebkitMask: "radial-gradient(ellipse at center, black 30%, transparent 70%)" }} />
        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: "20px" }}><Badge>Open Source</Badge></div>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 800, color: colors.text, lineHeight: 1.1, letterSpacing: "-2px", margin: "0 0 16px" }}>
            React components<br /><span style={{ color: colors.accent }}>for beautiful PDFs</span>
          </h1>
          <p style={{ fontSize: "17px", color: colors.textMuted, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 32px" }}>
            A collection of high-quality, unstyled components for creating PDF documents with React. Invoices, reports, certificates \u2014 built right.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <GlowButton primary icon="\u2192">Get Started</GlowButton>
            <GlowButton icon="\u2B21">GitHub</GlowButton>
          </div>
          <div style={{ display: "flex", gap: "32px", justifyContent: "center", marginTop: "40px", flexWrap: "wrap" }}>
            {[{ v: "2.4K", l: "GitHub Stars" }, { v: "18", l: "Components" }, { v: "48K", l: "Weekly Downloads" }].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color: colors.text }}>{s.v}</div>
                <div style={{ fontSize: "12px", color: colors.textDim }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "0 32px 48px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "12px", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
          <span><span style={{ color: colors.textDim }}>$</span> <span style={{ color: colors.textMuted }}>npm install</span> <span style={{ color: colors.accent }}>{PKG_REACT}</span></span>
          <span style={{ color: colors.textDim, cursor: "pointer" }}>{"\u{1F4CB}"}</span>
        </div>
      </section>

      <section style={{ padding: "0 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <div style={{ width: 220, flexShrink: 0 }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: colors.textDim, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", padding: "0 12px" }}>Components</div>
            {comps.map(c => (
              <button key={c.name} onClick={() => setSel(c.name)} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px 12px", borderRadius: "8px", border: "none", background: sel === c.name ? colors.surfaceHover : "transparent", color: sel === c.name ? colors.text : colors.textMuted, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: "15px" }}>{c.icon}</span>
                <div><div>{c.name}</div><div style={{ fontSize: "11px", color: colors.textDim, marginTop: "1px" }}>{c.desc}</div></div>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CodeBlock title={`${sel}.tsx`} code={codes[sel]} />
            <div style={{ marginTop: "20px", background: "#fff", borderRadius: "12px", padding: "40px", border: `1px solid ${colors.border}`, color: "#111", fontFamily: "'Georgia', serif", position: "relative" }}>
              <div style={{ position: "absolute", top: 12, right: 16, fontSize: "10px", color: "#999", fontFamily: "monospace" }}>PDF Preview</div>
              {previews[sel]}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 700, color: colors.text, letterSpacing: "-0.5px", marginBottom: "32px" }}>Built for real PDFs</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {[
            { icon: "\u2702\uFE0F", title: "Smart Page Breaks", desc: "No more orphaned headings or split table rows. Automatic widow/orphan protection." },
            { icon: "\u{1F504}", title: "Repeating Headers", desc: "Headers and footers repeat on every page with dynamic page numbers." },
            { icon: "\u{1F4CA}", title: "Auto-Paginating Tables", desc: "Tables that span 100+ pages with repeating column headers." },
            { icon: "\u{1F3A8}", title: "Full CSS Support", desc: "Flexbox, Grid, @media print, @page rules \u2014 all work correctly." },
            { icon: "\u{1F524}", title: "Custom Fonts", desc: "WOFF2, TTF, OTF. Google Fonts built in." },
            { icon: "\u26A1", title: "Type-Safe", desc: "Full TypeScript support with autocomplete for every prop." },
          ].map(f => (
            <div key={f.title} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "14px", padding: "24px" }}>
              <div style={{ fontSize: "24px", marginBottom: "12px" }}>{f.icon}</div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "6px" }}>{f.title}</div>
              <div style={{ fontSize: "13px", color: colors.textMuted, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// ─── VIEW 2: PRODUCT LANDING ───
const ProductLandingView = () => (
  <div style={{ minHeight: "100vh" }}>
    <div style={{ padding: "12px 32px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: "32px" }}>
        {["Product", "Pricing", "Docs", "Templates", "Blog"].map(item => <span key={item} style={{ fontSize: "13px", color: colors.textMuted, cursor: "pointer", fontWeight: 500 }}>{item}</span>)}
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        <GlowButton small>Log In</GlowButton>
        <GlowButton small primary>Get API Key</GlowButton>
      </div>
    </div>

    <section style={{ padding: "100px 32px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 600, background: `radial-gradient(ellipse, ${colors.accentGlow} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
        <Badge color={colors.green}>Now in Public Beta</Badge>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 68px)", fontWeight: 800, color: colors.text, lineHeight: 1.05, letterSpacing: "-3px", margin: "24px 0 20px" }}>
          Generate PDFs<br />
          <span style={{ background: `linear-gradient(135deg, ${colors.accent}, #FBBF24)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>in 3 lines of code</span>
        </h1>
        <p style={{ fontSize: "18px", color: colors.textMuted, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 36px" }}>
          The PDF generation API that just works. HTML in, pixel-perfect PDF out. No headless browsers to manage. No rendering bugs to chase.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <GlowButton primary icon="\u26A1">Start Free \u2014 1,000 PDFs/mo</GlowButton>
          <GlowButton icon="\u25B6">View Demo</GlowButton>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "32px", fontSize: "13px", color: colors.textDim }}>
          <span style={{ color: colors.green }}>{"\u25CF"}</span> 2,847 developers generating PDFs this week
        </div>
      </div>
    </section>

    <section style={{ padding: "0 32px 80px", maxWidth: 720, margin: "0 auto" }}>
      <CodeBlock title="invoice.ts" code={`${IM} { DocuForge } from '${PKG}';

const df = new DocuForge('df_live_...');

const pdf = await df.generate({
  html: invoiceHTML,
  options: {
    format: 'A4',
    margin: '1in',
    header: '<div>Acme Corp</div>',
    footer: '<div>Page {{pageNumber}} of {{totalPages}}</div>'
  }
});

// pdf.url \u2192 https://cdn.docuforge.dev/gen_k8x92m.pdf
// pdf.pages \u2192 2
// pdf.generation_time_ms \u2192 1,240`} />
    </section>

    <section style={{ padding: "0 32px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
        {[
          { icon: "\u25C7", ic: colors.accent, title: "HTML \u2192 PDF", desc: "Send any HTML. Get a perfect PDF. CSS Grid, Flexbox, custom fonts, SVGs \u2014 all rendered exactly right.", code: `await df.generate({\n  html: '<h1>Hello</h1>'\n})` },
          { icon: "\u25C6", ic: colors.blue, title: "Templates", desc: "Design once, merge data forever. Visual editor for non-technical teammates. Version control built in.", code: `await df.fromTemplate({\n  template: 'tmpl_invoice_v2',\n  data: { name: 'Acme', total: 1500 }\n})` },
          { icon: "\u25CF", ic: colors.purple, title: "React Components", desc: "Build PDF layouts with React. Type-safe props, auto-pagination, composable components.", code: `await df.generate({\n  react: <Invoice data={data} />\n})` },
        ].map(p => (
          <div key={p.title} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "16px", padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "28px", color: p.ic }}>{p.icon}</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: colors.text }}>{p.title}</div>
            <div style={{ fontSize: "14px", color: colors.textMuted, lineHeight: 1.6 }}>{p.desc}</div>
            <CodeBlock code={p.code} compact />
          </div>
        ))}
      </div>
    </section>

    <section style={{ padding: "0 32px 80px", maxWidth: 1000, margin: "0 auto" }}>
      <h2 style={{ fontSize: "32px", fontWeight: 800, color: colors.text, letterSpacing: "-1px", textAlign: "center", marginBottom: "40px" }}>Simple, per-PDF pricing</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {[
          { name: "Free", price: "$0", period: "forever", features: ["1,000 PDFs/month", "10MB max", "Community support", "2 API keys"], accent: false },
          { name: "Starter", price: "$29", period: "/month", features: ["10,000 PDFs/month", "25MB max", "Email support", "Custom fonts", "Template editor"], accent: false },
          { name: "Pro", price: "$99", period: "/month", features: ["100,000 PDFs/month", "50MB max", "Priority support", "Batch generation", "React components", "Webhooks"], accent: true },
          { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited PDFs", "SLA guarantee", "SSO / SAML", "On-prem option", "Dedicated support"], accent: false },
        ].map(plan => (
          <div key={plan.name} style={{ background: plan.accent ? colors.surface : colors.bg, border: `1px solid ${plan.accent ? colors.accent + "44" : colors.border}`, borderRadius: "16px", padding: "28px", position: "relative", boxShadow: plan.accent ? `0 0 40px ${colors.accentGlow}` : "none" }}>
            {plan.accent && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)" }}><Badge>Most Popular</Badge></div>}
            <div style={{ fontSize: "14px", fontWeight: 600, color: colors.textMuted, marginBottom: "8px" }}>{plan.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px", marginBottom: "20px" }}>
              <span style={{ fontSize: "36px", fontWeight: 800, color: colors.text, letterSpacing: "-1px" }}>{plan.price}</span>
              <span style={{ fontSize: "14px", color: colors.textDim }}>{plan.period}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {plan.features.map(f => <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: colors.textMuted }}><span style={{ color: colors.green, fontSize: "12px" }}>{"\u2713"}</span>{f}</div>)}
            </div>
            <div style={{ marginTop: "24px" }}><GlowButton primary={plan.accent} small>{plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}</GlowButton></div>
          </div>
        ))}
      </div>
    </section>

    <section style={{ padding: "60px 32px", maxWidth: 800, margin: "0 auto 60px", background: colors.surface, borderRadius: "20px", border: `1px solid ${colors.border}`, textAlign: "center" }}>
      <Badge color={colors.purple}>AI-Native</Badge>
      <h2 style={{ fontSize: "28px", fontWeight: 700, color: colors.text, letterSpacing: "-0.5px", margin: "16px 0 12px" }}>Built for the vibe coding era</h2>
      <p style={{ fontSize: "15px", color: colors.textMuted, lineHeight: 1.6, maxWidth: 500, margin: "0 auto 32px" }}>
        MCP server for Cursor & Claude Code. llms.txt for every AI model. Your AI assistant already knows how to use DocuForge.
      </p>
      <CodeBlock title="Cursor / Claude Code" code={`> "Generate an invoice PDF for $1,500 to Acme Corp
   for 10 hours of consulting at $150/hr"

\u2713 Using DocuForge MCP server...
\u2713 Template: invoice_standard
\u2713 Generated: https://cdn.docuforge.dev/gen_m3kx9.pdf (2 pages, 1.2s)`} compact />
    </section>
  </div>
);

// ─── VIEW 3: DASHBOARD ───
const DashboardView = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const gens = [
    { id: "gen_k8x92m", tmpl: "Invoice", pages: 2, time: "1.2s", status: "done", ago: "2m ago" },
    { id: "gen_m3kx90", tmpl: "Report", pages: 14, time: "4.8s", status: "done", ago: "8m ago" },
    { id: "gen_p1nq82", tmpl: "Certificate", pages: 1, time: "0.9s", status: "done", ago: "12m ago" },
    { id: "gen_r9wk31", tmpl: "HTML", pages: 3, time: "1.7s", status: "done", ago: "1h ago" },
    { id: "gen_t5mx88", tmpl: "Invoice", pages: 2, time: "1.3s", status: "fail", ago: "2h ago" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
      <div style={{ width: 220, borderRight: `1px solid ${colors.borderSubtle}`, padding: "20px 12px", flexShrink: 0 }}>
        {[{ id: "overview", icon: "\u25FB", label: "Overview" }, { id: "generations", icon: "\u25C7", label: "Generations" }, { id: "templates", icon: "\u25A6", label: "Templates" }, { id: "keys", icon: "\u{1F511}", label: "API Keys" }, { id: "settings", icon: "\u2699", label: "Settings" }].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "9px 12px", borderRadius: "8px", border: "none", background: activeTab === item.id ? colors.surfaceHover : "transparent", color: activeTab === item.id ? colors.text : colors.textMuted, fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: "2px" }}>
            <span style={{ fontSize: "14px", opacity: 0.7 }}>{item.icon}</span>{item.label}
          </button>
        ))}
        <div style={{ margin: "20px 12px", borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: "16px" }}>
          <div style={{ fontSize: "11px", color: colors.textDim, marginBottom: "8px" }}>Usage This Month</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: colors.text }}>7,842</div>
          <div style={{ fontSize: "11px", color: colors.textDim }}>of 10,000 PDFs</div>
          <div style={{ marginTop: "8px", height: "4px", borderRadius: "2px", background: colors.border, overflow: "hidden" }}>
            <div style={{ width: "78%", height: "100%", borderRadius: "2px", background: `linear-gradient(90deg, ${colors.accent}, #FBBF24)` }} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: colors.text, letterSpacing: "-0.5px", margin: 0 }}>Overview</h1>
          <GlowButton small primary icon="\u26A1">Generate PDF</GlowButton>
        </div>
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
          <StatCard value="7,842" label="PDFs Generated" trend="+23%" />
          <StatCard value="1.4s" label="Avg Generation Time" trend="-12%" />
          <StatCard value="99.7%" label="Success Rate" />
          <StatCard value="$29" label="Current Plan" />
        </div>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "14px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Generation Volume</span>
            <div style={{ display: "flex", gap: "8px" }}>
              {["7d", "30d", "90d"].map(p => <button key={p} style={{ padding: "4px 10px", borderRadius: "6px", border: `1px solid ${p === "30d" ? colors.accent + "44" : colors.border}`, background: p === "30d" ? colors.accentSoft : "transparent", color: p === "30d" ? colors.accent : colors.textDim, fontSize: "11px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>{p}</button>)}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "120px", padding: "0 8px" }}>
            {[35,42,28,55,48,62,45,70,58,78,65,82,72,90,68,85,92,78,95,88,100,82,96,88,105,92,110,98,115,108].map((h, i) => <div key={i} style={{ flex: 1, height: `${(h/115)*100}%`, borderRadius: "3px 3px 0 0", background: i >= 27 ? `linear-gradient(180deg, ${colors.accent}, ${colors.accent}88)` : `linear-gradient(180deg, ${colors.accent}44, ${colors.accent}22)` }} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "10px", color: colors.textDim }}><span>Jan 25</span><span>Feb 8</span><span>Feb 24</span></div>
        </div>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "14px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.borderSubtle}` }}><span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>Recent Generations</span></div>
          {gens.map((gen, i) => (
            <div key={gen.id} style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderBottom: i < gens.length - 1 ? `1px solid ${colors.borderSubtle}` : "none", gap: "16px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: gen.status === "done" ? colors.green : colors.red, flexShrink: 0 }} />
              <div style={{ flex: 1 }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: colors.text, fontWeight: 500 }}>{gen.id}</span></div>
              <div style={{ fontSize: "12px", color: colors.textDim, width: 80 }}>{gen.tmpl}</div>
              <div style={{ fontSize: "12px", color: colors.textDim, width: 60 }}>{gen.pages} {gen.pages === 1 ? "page" : "pages"}</div>
              <div style={{ fontSize: "12px", color: colors.textDim, width: 50 }}>{gen.time}</div>
              <div style={{ fontSize: "11px", color: colors.textDim, width: 60, textAlign: "right" }}>{gen.ago}</div>
            </div>
          ))}
        </div>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "14px", padding: "20px", marginTop: "24px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "12px" }}>Your API Key</div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#0D0D0F", border: `1px solid ${colors.border}`, borderRadius: "8px", padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
            <span style={{ color: colors.textMuted, flex: 1 }}>df_live_sk_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022k8x9</span>
            <span style={{ color: colors.textDim, cursor: "pointer" }}>{"\u{1F4CB}"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── VIEW 4: DOCS ───
const DocsView = () => (
  <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
    <div style={{ width: 240, borderRight: `1px solid ${colors.borderSubtle}`, padding: "24px 16px", flexShrink: 0 }}>
      {[
        { section: "Getting Started", items: ["Introduction", "Quickstart", "Authentication", "SDKs"] },
        { section: "Core Concepts", items: ["HTML to PDF", "React to PDF", "Templates", "Page Layout"] },
        { section: "API Reference", items: ["POST /generate", "GET /generations/:id", "POST /templates", "GET /usage"] },
        { section: "Guides", items: ["Next.js", "Express", "FastAPI", "Django", "Rails"] },
      ].map(g => (
        <div key={g.section} style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: colors.textDim, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px", padding: "0 8px" }}>{g.section}</div>
          {g.items.map((item, i) => (
            <div key={item} style={{ padding: "6px 8px", borderRadius: "6px", fontSize: "13px", color: i === 0 && g.section === "Getting Started" ? colors.accent : colors.textMuted, fontWeight: i === 0 && g.section === "Getting Started" ? 600 : 400, background: i === 0 && g.section === "Getting Started" ? colors.accentSoft : "transparent", cursor: "pointer", marginBottom: "1px" }}>{item}</div>
          ))}
        </div>
      ))}
    </div>
    <div style={{ flex: 1, padding: "32px 48px", maxWidth: 780 }}>
      <Badge>Docs</Badge>
      <h1 style={{ fontSize: "32px", fontWeight: 800, color: colors.text, letterSpacing: "-1px", margin: "16px 0 12px" }}>Introduction</h1>
      <p style={{ fontSize: "15px", color: colors.textMuted, lineHeight: 1.7, margin: "0 0 28px" }}>
        DocuForge is a PDF generation API for developers. Send HTML, React components, or template data \u2014 get pixel-perfect PDFs back. No headless browsers to manage, no rendering bugs to chase.
      </p>

      <h2 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: "0 0 16px", paddingTop: "8px", borderTop: `1px solid ${colors.borderSubtle}` }}>Quick Start</h2>
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", color: colors.textMuted, marginBottom: "8px" }}>1. Install the SDK</div>
        <CodeBlock code={`npm install ${PKG}`} compact />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", color: colors.textMuted, marginBottom: "8px" }}>2. Generate your first PDF</div>
        <CodeBlock title="generate.ts" code={`${IM} { DocuForge } from '${PKG}';

const df = new DocuForge(process.env.DOCUFORGE_API_KEY);

const pdf = await df.generate({
  html: \`
    <h1>Hello from DocuForge</h1>
    <p>This took 30 seconds, not 3 days.</p>
  \`,
  options: { format: 'A4' }
});

console.log(pdf.url);
// \u2192 https://cdn.docuforge.dev/gen_abc123.pdf`} />
      </div>
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", color: colors.textMuted, marginBottom: "8px" }}>3. Use with templates</div>
        <CodeBlock title="template.ts" code={`const invoice = await df.fromTemplate({
  template: 'tmpl_invoice_v2',
  data: {
    company: 'Acme Corp',
    items: [
      { description: 'Consulting', qty: 10, rate: 150 },
      { description: 'Development', qty: 40, rate: 175 },
    ],
    total: 8500
  }
});`} />
      </div>

      <h2 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: "32px 0 16px", paddingTop: "8px", borderTop: `1px solid ${colors.borderSubtle}` }}>Three Ways to Generate</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
        {[
          { method: "HTML \u2192 PDF", desc: "Send raw HTML, get a PDF. Full CSS support.", color: colors.accent },
          { method: "React \u2192 PDF", desc: "Use React components for type-safe layouts.", color: colors.blue },
          { method: "Template \u2192 PDF", desc: "Design templates, merge data via API.", color: colors.purple },
        ].map(m => (
          <div key={m.method} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "16px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, marginBottom: "10px" }} />
            <div style={{ fontSize: "13px", fontWeight: 600, color: colors.text, marginBottom: "4px" }}>{m.method}</div>
            <div style={{ fontSize: "12px", color: colors.textDim, lineHeight: 1.4 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: "32px 0 16px", paddingTop: "8px", borderTop: `1px solid ${colors.borderSubtle}` }}>API Reference</h2>
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: "10px", overflow: "hidden" }}>
        {[
          { method: "POST", path: "/v1/generate", desc: "Generate a PDF from HTML, React, or template" },
          { method: "GET", path: "/v1/generations/:id", desc: "Get generation status and result" },
          { method: "POST", path: "/v1/templates", desc: "Create or update a template" },
          { method: "GET", path: "/v1/templates", desc: "List all templates" },
          { method: "POST", path: "/v1/batch", desc: "Generate multiple PDFs" },
          { method: "GET", path: "/v1/usage", desc: "Get usage for current billing period" },
        ].map((ep, i) => (
          <div key={ep.path} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: i < 5 ? `1px solid ${colors.borderSubtle}` : "none", gap: "12px", cursor: "pointer" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: ep.method === "POST" ? `${colors.green}22` : `${colors.blue}22`, color: ep.method === "POST" ? colors.green : colors.blue, minWidth: 38, textAlign: "center" }}>{ep.method}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: colors.text, fontWeight: 500 }}>{ep.path}</span>
            <span style={{ fontSize: "12px", color: colors.textDim, marginLeft: "auto" }}>{ep.desc}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── MAIN ───
export default function DocuForgeMockups() {
  const [currentView, setCurrentView] = useState(VIEWS.LIBRARY);
  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: colors.bg, color: colors.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        button:hover { opacity: 0.9; }
      `}</style>
      <TopNav currentView={currentView} setCurrentView={setCurrentView} />
      {currentView === VIEWS.LIBRARY && <ComponentLibraryView />}
      {currentView === VIEWS.PRODUCT && <ProductLandingView />}
      {currentView === VIEWS.DASHBOARD && <DashboardView />}
      {currentView === VIEWS.DOCS && <DocsView />}
    </div>
  );
}
