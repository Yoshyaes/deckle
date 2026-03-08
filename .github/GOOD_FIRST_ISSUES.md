# Good First Issues

Ready-to-create GitHub issues for attracting contributors. Copy each into a new GitHub Issue when the repo goes public.

---

## 1. Add `className` prop to all components

**Labels:** `good first issue`, `enhancement`

Currently, components accept a `style` prop for inline CSS but not a `className` prop. Adding `className` support would let users apply CSS classes from their stylesheets.

**Components to update:** Document, Page, Header, Footer, Table, Grid, Watermark, Barcode, Signature

**Acceptance criteria:**
- Each component accepts an optional `className?: string` prop
- The className is applied to the outermost element
- Existing `style` prop continues to work alongside className
- Export updated prop types from `src/index.ts`

**Files:** `packages/react/src/components/*.tsx`, `packages/react/src/index.ts`

---

## 2. Add `PageNumber` component

**Labels:** `good first issue`, `enhancement`

Create a `PageNumber` component that renders the `{{pageNumber}}` and `{{totalPages}}` placeholders. The DocuForge API replaces these with actual values during PDF generation (similar to how the `Barcode` component works).

**Example usage:**
```tsx
<PageNumber format="Page {{pageNumber}} of {{totalPages}}" />
// or simply:
<PageNumber />  // renders "Page 1 of 3"
```

**Acceptance criteria:**
- New `PageNumber` component in `packages/react/src/components/PageNumber.tsx`
- Accepts optional `format` string prop (default: `"Page {{pageNumber}} of {{totalPages}}"`)
- Accepts optional `style` prop
- Exported from `packages/react/src/index.ts`

---

## 3. Add more page sizes (A3, A5, B5, Tabloid)

**Labels:** `good first issue`, `enhancement`

The `Page` component currently supports A4, Letter, and Legal sizes. Add support for additional standard paper sizes.

**Sizes to add:**
- A3: 297mm x 420mm
- A5: 148mm x 210mm
- B5: 176mm x 250mm
- Tabloid: 11in x 17in

**Acceptance criteria:**
- Update the `size` prop type to include the new options
- Add dimensions to the `pageSizes` map in `Page.tsx`
- Each size works in both portrait and landscape orientations
- Update the README page dimensions table

**Files:** `packages/react/src/components/Page.tsx`, `packages/react/README.md`

---

## 4. Add `Divider` component

**Labels:** `good first issue`, `enhancement`

Create a simple `Divider` (horizontal rule) component for visually separating sections in PDF documents.

**Example usage:**
```tsx
<Divider />
<Divider thickness="2px" color="#e5e7eb" spacing="20px" />
```

**Acceptance criteria:**
- New `Divider` component in `packages/react/src/components/Divider.tsx`
- Props: `thickness?: string` (default "1px"), `color?: string` (default "#d1d5db"), `spacing?: string` (default "16px" applied as vertical margin), `style?: CSSProperties`
- Exported from `packages/react/src/index.ts`

---

## 5. Add `List` component for styled ordered/unordered lists

**Labels:** `good first issue`, `enhancement`

Create a `List` component that renders styled ordered or unordered lists, consistent with the library's design language.

**Example usage:**
```tsx
<List items={['Item one', 'Item two', 'Item three']} />
<List items={['First', 'Second', 'Third']} ordered />
```

**Acceptance criteria:**
- New `List` component in `packages/react/src/components/List.tsx`
- Props: `items: (string | ReactNode)[]`, `ordered?: boolean` (default false), `style?: CSSProperties`
- Renders `<ul>` or `<ol>` with consistent styling (font-size: 12px, line-height: 1.6, color: #1a1a1a)
- Exported from `packages/react/src/index.ts`
