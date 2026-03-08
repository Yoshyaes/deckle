# DocuForge Python SDK

PDF generation API for developers. HTML in, pixel-perfect PDF out.

## Installation

```bash
pip install docuforge
```

## Quick Start

```python
from docuforge import DocuForge

df = DocuForge("df_live_...")

# Generate a PDF from HTML
pdf = df.generate(
    html="<h1>Invoice #1234</h1><p>Amount: $500</p>",
    options={"format": "A4", "margin": "1in"}
)

print(pdf.url)    # https://cdn.docuforge.dev/gen_abc123.pdf
print(pdf.pages)  # 2
```

## Generate from Template

```python
pdf = df.from_template(
    template="tmpl_invoice_v2",
    data={
        "company": "Acme Corp",
        "items": [
            {"description": "Consulting", "qty": 10, "rate": 150}
        ],
        "total": 1500
    }
)
```

## PDF Options

```python
from docuforge import PDFOptions

pdf = df.generate(
    html=invoice_html,
    options=PDFOptions(
        format="A4",
        margin="1in",
        orientation="portrait",
        header="<div>Acme Corp</div>",
        footer="<div>Page {{pageNumber}} of {{totalPages}}</div>",
        print_background=True
    )
)
```

## Templates

```python
# Create
template = df.templates.create(
    name="Invoice",
    html_content="<h1>Invoice for {{company}}</h1>",
    schema={"company": "string", "total": "number"}
)

# List
templates = df.templates.list()

# Update
df.templates.update("tmpl_abc123", html_content="<h1>Updated</h1>")

# Delete
df.templates.delete("tmpl_abc123")
```

## Error Handling

```python
from docuforge import DocuForge, DocuForgeError, RateLimitError

try:
    pdf = df.generate(html="<h1>Hello</h1>")
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after}s")
except DocuForgeError as e:
    print(f"Error {e.code}: {e.message}")
```

## License

MIT
