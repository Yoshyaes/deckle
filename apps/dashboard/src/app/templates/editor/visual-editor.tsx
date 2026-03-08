'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DOMPurify from 'dompurify';
import {
  ArrowLeft,
  Type,
  Heading as HeadingIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Space,
  Columns2,
  Columns3,
  X,
  ChevronUp,
  ChevronDown,
  Eye,
  Code,
  Save,
  GripVertical,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ElementProps {
  [key: string]: unknown;
}

interface CanvasElement {
  id: string;
  type: string;
  props: ElementProps;
}

type ElementType =
  | 'heading'
  | 'text'
  | 'image'
  | 'table'
  | 'divider'
  | 'spacer'
  | 'two-column'
  | 'three-column';

interface PaletteItem {
  type: ElementType;
  label: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Palette definition
// ---------------------------------------------------------------------------

const PALETTE: PaletteItem[] = [
  { type: 'heading', label: 'Heading', icon: <HeadingIcon size={16} /> },
  { type: 'text', label: 'Text Block', icon: <Type size={16} /> },
  { type: 'image', label: 'Image', icon: <ImageIcon size={16} /> },
  { type: 'table', label: 'Table', icon: <TableIcon size={16} /> },
  { type: 'divider', label: 'Divider', icon: <Minus size={16} /> },
  { type: 'spacer', label: 'Spacer', icon: <Space size={16} /> },
  { type: 'two-column', label: 'Two Column', icon: <Columns2 size={16} /> },
  { type: 'three-column', label: 'Three Column', icon: <Columns3 size={16} /> },
];

// ---------------------------------------------------------------------------
// Default props for each element type
// ---------------------------------------------------------------------------

function defaultPropsFor(type: ElementType): ElementProps {
  switch (type) {
    case 'heading':
      return { text: 'Heading', level: 'h2', align: 'left', color: '#000000' };
    case 'text':
      return {
        text: 'Enter your text here...',
        align: 'left',
        fontSize: '16',
        color: '#333333',
      };
    case 'image':
      return {
        src: 'https://placehold.co/600x200/e2e8f0/64748b?text=Image',
        alt: 'Image',
        width: '100',
        align: 'center',
      };
    case 'table':
      return {
        rows: 3,
        cols: 3,
        headerRow: true,
        cells: [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Cell 1', 'Cell 2', 'Cell 3'],
          ['Cell 4', 'Cell 5', 'Cell 6'],
        ],
      };
    case 'divider':
      return { color: '#d1d5db', thickness: '1', margin: '16' };
    case 'spacer':
      return { height: '32' };
    case 'two-column':
      return { left: 'Left column content', right: 'Right column content' };
    case 'three-column':
      return {
        col1: 'Column 1 content',
        col2: 'Column 2 content',
        col3: 'Column 3 content',
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Unique ID generator
// ---------------------------------------------------------------------------

let _counter = 0;
function uid(): string {
  _counter += 1;
  return `el_${Date.now()}_${_counter}`;
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function generateCellsHtml(cells: string[][], headerRow: boolean): string {
  let html = '<table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;">';
  cells.forEach((row, ri) => {
    html += '<tr>';
    row.forEach((cell) => {
      const tag = headerRow && ri === 0 ? 'th' : 'td';
      const bg = headerRow && ri === 0 ? 'background:#f3f4f6;font-weight:600;' : '';
      html += `<${tag} style="border:1px solid #d1d5db;padding:8px 12px;text-align:left;${bg}">${escHtml(cell)}</${tag}>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  return html;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function elementToHtml(el: CanvasElement): string {
  const p = el.props;
  switch (el.type) {
    case 'heading': {
      const tag = (p.level as string) || 'h2';
      const sizes: Record<string, string> = {
        h1: '32px',
        h2: '24px',
        h3: '20px',
        h4: '18px',
        h5: '16px',
        h6: '14px',
      };
      return `<${tag} style="margin:0 0 8px 0;text-align:${p.align || 'left'};color:${p.color || '#000'};font-size:${sizes[tag] || '24px'};">${escHtml(String(p.text || ''))}</${tag}>`;
    }
    case 'text':
      return `<p style="margin:0 0 12px 0;text-align:${p.align || 'left'};font-size:${p.fontSize || 16}px;color:${p.color || '#333'};line-height:1.6;">${escHtml(String(p.text || '')).replace(/\n/g, '<br/>')}</p>`;
    case 'image': {
      const w = p.width ? `${p.width}%` : '100%';
      const containerAlign =
        p.align === 'center'
          ? 'margin:0 auto;'
          : p.align === 'right'
            ? 'margin-left:auto;'
            : '';
      return `<img src="${escHtml(String(p.src || ''))}" alt="${escHtml(String(p.alt || ''))}" style="display:block;max-width:${w};height:auto;${containerAlign}" />`;
    }
    case 'table':
      return generateCellsHtml(
        (p.cells as string[][]) || [['']],
        (p.headerRow as boolean) ?? true,
      );
    case 'divider':
      return `<hr style="border:none;border-top:${p.thickness || 1}px solid ${p.color || '#d1d5db'};margin:${p.margin || 16}px 0;" />`;
    case 'spacer':
      return `<div style="height:${p.height || 32}px;"></div>`;
    case 'two-column':
      return `<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0"><tr><td style="width:50%;vertical-align:top;padding-right:12px;">${escHtml(String(p.left || '')).replace(/\n/g, '<br/>')}</td><td style="width:50%;vertical-align:top;padding-left:12px;">${escHtml(String(p.right || '')).replace(/\n/g, '<br/>')}</td></tr></table>`;
    case 'three-column':
      return `<table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0"><tr><td style="width:33.33%;vertical-align:top;padding-right:8px;">${escHtml(String(p.col1 || '')).replace(/\n/g, '<br/>')}</td><td style="width:33.33%;vertical-align:top;padding:0 8px;">${escHtml(String(p.col2 || '')).replace(/\n/g, '<br/>')}</td><td style="width:33.33%;vertical-align:top;padding-left:8px;">${escHtml(String(p.col3 || '')).replace(/\n/g, '<br/>')}</td></tr></table>`;
    default:
      return '';
  }
}

function generateFullHtml(elements: CanvasElement[]): string {
  const body = elements.map(elementToHtml).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 40px;
    color: #1a1a1a;
    line-height: 1.6;
  }
  img { max-width: 100%; }
  table { font-size: 14px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Canvas element renderer
// ---------------------------------------------------------------------------

function CanvasElementView({
  el,
  selected,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  el: CanvasElement;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const p = el.props;

  const renderContent = () => {
    switch (el.type) {
      case 'heading': {
        const Tag = (p.level as keyof JSX.IntrinsicElements) || 'h2';
        const sizes: Record<string, string> = {
          h1: '2rem',
          h2: '1.5rem',
          h3: '1.25rem',
          h4: '1.125rem',
          h5: '1rem',
          h6: '0.875rem',
        };
        return (
          <Tag
            style={{
              margin: 0,
              textAlign: (p.align as 'left' | 'center' | 'right') || 'left',
              color: (p.color as string) || '#000',
              fontSize: sizes[String(p.level)] || '1.5rem',
            }}
          >
            {String(p.text || 'Heading')}
          </Tag>
        );
      }
      case 'text':
        return (
          <p
            style={{
              margin: 0,
              textAlign: (p.align as 'left' | 'center' | 'right') || 'left',
              fontSize: `${p.fontSize || 16}px`,
              color: (p.color as string) || '#333',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {String(p.text || '')}
          </p>
        );
      case 'image':
        return (
          <div style={{ textAlign: (p.align as 'left' | 'center' | 'right') || 'center' }}>
            <img
              src={String(p.src || '')}
              alt={String(p.alt || '')}
              style={{
                maxWidth: `${p.width || 100}%`,
                height: 'auto',
                display: 'inline-block',
              }}
            />
          </div>
        );
      case 'table': {
        const cells = (p.cells as string[][]) || [['']];
        const hasHeader = (p.headerRow as boolean) ?? true;
        return (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #d1d5db',
              fontSize: '14px',
            }}
          >
            <tbody>
              {cells.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => {
                    const isHeader = hasHeader && ri === 0;
                    const Tag = isHeader ? 'th' : 'td';
                    return (
                      <Tag
                        key={ci}
                        style={{
                          border: '1px solid #d1d5db',
                          padding: '8px 12px',
                          textAlign: 'left',
                          background: isHeader ? '#f3f4f6' : 'transparent',
                          fontWeight: isHeader ? 600 : 400,
                        }}
                      >
                        {cell}
                      </Tag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case 'divider':
        return (
          <hr
            style={{
              border: 'none',
              borderTop: `${p.thickness || 1}px solid ${p.color || '#d1d5db'}`,
              margin: `${p.margin || 16}px 0`,
            }}
          />
        );
      case 'spacer':
        return (
          <div
            style={{ height: `${p.height || 32}px`, background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.03) 5px, rgba(0,0,0,0.03) 10px)' }}
            className="flex items-center justify-center"
          >
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{String(p.height || 32)}px</span>
          </div>
        );
      case 'two-column':
        return (
          <div style={{ display: 'flex', gap: '24px' }}>
            <div
              style={{
                flex: 1,
                padding: '12px',
                border: '1px dashed #d1d5db',
                borderRadius: '4px',
                minHeight: '60px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {String(p.left || '')}
            </div>
            <div
              style={{
                flex: 1,
                padding: '12px',
                border: '1px dashed #d1d5db',
                borderRadius: '4px',
                minHeight: '60px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {String(p.right || '')}
            </div>
          </div>
        );
      case 'three-column':
        return (
          <div style={{ display: 'flex', gap: '16px' }}>
            {['col1', 'col2', 'col3'].map((key) => (
              <div
                key={key}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px dashed #d1d5db',
                  borderRadius: '4px',
                  minHeight: '60px',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {String(p[key] || '')}
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-lg transition-all cursor-pointer ${
        selected
          ? 'ring-2 ring-blue shadow-lg shadow-blue/10'
          : 'hover:ring-1 hover:ring-border'
      }`}
    >
      {/* Floating controls */}
      <div
        className={`absolute -top-3 -right-3 z-10 flex items-center gap-0.5 transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={isFirst}
          className="p-1 rounded bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          title="Move up"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={isLast}
          className="p-1 rounded bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
          title="Move down"
        >
          <ChevronDown size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded bg-surface border border-border text-red hover:bg-red/10 transition-colors"
          title="Delete"
        >
          <X size={12} />
        </button>
      </div>

      {/* Element type badge */}
      <div
        className={`absolute -top-2.5 left-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide transition-opacity ${
          selected
            ? 'bg-blue text-white opacity-100'
            : 'bg-surface border border-border text-text-dim opacity-0 group-hover:opacity-100'
        }`}
      >
        <GripVertical size={10} />
        {el.type}
      </div>

      {/* Content */}
      <div className="p-4 bg-white rounded-lg text-black">
        {renderContent()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------

function PropertiesPanel({
  el,
  onChange,
}: {
  el: CanvasElement;
  onChange: (props: ElementProps) => void;
}) {
  const p = el.props;

  const set = (key: string, value: unknown) => {
    onChange({ ...p, [key]: value });
  };

  const inputClass =
    'w-full bg-[#0D0D0F] border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 transition-colors';
  const labelClass = 'block text-[11px] font-medium text-text-dim uppercase tracking-wide mb-1.5';
  const selectClass =
    'w-full bg-[#0D0D0F] border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 transition-colors appearance-none';

  switch (el.type) {
    case 'heading':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Text</label>
            <input
              type="text"
              value={String(p.text || '')}
              onChange={(e) => set('text', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Level</label>
            <select
              value={String(p.level || 'h2')}
              onChange={(e) => set('level', e.target.value)}
              className={selectClass}
            >
              {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => (
                <option key={h} value={h}>
                  {h.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Alignment</label>
            <AlignmentPicker value={String(p.align || 'left')} onChange={(v) => set('align', v)} />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={String(p.color || '#000000')}
                onChange={(e) => set('color', e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={String(p.color || '#000000')}
                onChange={(e) => set('color', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Content</label>
            <textarea
              value={String(p.text || '')}
              onChange={(e) => set('text', e.target.value)}
              rows={6}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className={labelClass}>Alignment</label>
            <AlignmentPicker value={String(p.align || 'left')} onChange={(v) => set('align', v)} />
          </div>
          <div>
            <label className={labelClass}>Font Size (px)</label>
            <input
              type="number"
              min={8}
              max={72}
              value={String(p.fontSize || '16')}
              onChange={(e) => set('fontSize', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={String(p.color || '#333333')}
                onChange={(e) => set('color', e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={String(p.color || '#333333')}
                onChange={(e) => set('color', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      );

    case 'image':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Image URL</label>
            <input
              type="text"
              value={String(p.src || '')}
              onChange={(e) => set('src', e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelClass}>Alt Text</label>
            <input
              type="text"
              value={String(p.alt || '')}
              onChange={(e) => set('alt', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Width (%)</label>
            <input
              type="number"
              min={10}
              max={100}
              value={String(p.width || '100')}
              onChange={(e) => set('width', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Alignment</label>
            <AlignmentPicker value={String(p.align || 'center')} onChange={(v) => set('align', v)} />
          </div>
        </div>
      );

    case 'table':
      return <TablePropertiesPanel props={p} onChange={onChange} />;

    case 'divider':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={String(p.color || '#d1d5db')}
                onChange={(e) => set('color', e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={String(p.color || '#d1d5db')}
                onChange={(e) => set('color', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Thickness (px)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={String(p.thickness || '1')}
              onChange={(e) => set('thickness', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Margin (px)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={String(p.margin || '16')}
              onChange={(e) => set('margin', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      );

    case 'spacer':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Height (px)</label>
            <input
              type="number"
              min={4}
              max={200}
              value={String(p.height || '32')}
              onChange={(e) => set('height', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      );

    case 'two-column':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Left Column</label>
            <textarea
              value={String(p.left || '')}
              onChange={(e) => set('left', e.target.value)}
              rows={5}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className={labelClass}>Right Column</label>
            <textarea
              value={String(p.right || '')}
              onChange={(e) => set('right', e.target.value)}
              rows={5}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      );

    case 'three-column':
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Column 1</label>
            <textarea
              value={String(p.col1 || '')}
              onChange={(e) => set('col1', e.target.value)}
              rows={4}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className={labelClass}>Column 2</label>
            <textarea
              value={String(p.col2 || '')}
              onChange={(e) => set('col2', e.target.value)}
              rows={4}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label className={labelClass}>Column 3</label>
            <textarea
              value={String(p.col3 || '')}
              onChange={(e) => set('col3', e.target.value)}
              rows={4}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      );

    default:
      return <p className="text-sm text-text-dim">No properties available.</p>;
  }
}

// ---------------------------------------------------------------------------
// Alignment picker sub-component
// ---------------------------------------------------------------------------

function AlignmentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = ['left', 'center', 'right'] as const;
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
            value === opt
              ? 'bg-accent/20 text-accent'
              : 'bg-[#0D0D0F] text-text-muted hover:text-text-primary'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table properties sub-component
// ---------------------------------------------------------------------------

function TablePropertiesPanel({
  props: p,
  onChange,
}: {
  props: ElementProps;
  onChange: (props: ElementProps) => void;
}) {
  const cells = (p.cells as string[][]) || [['']];
  const rows = cells.length;
  const cols = cells[0]?.length || 1;

  const labelClass = 'block text-[11px] font-medium text-text-dim uppercase tracking-wide mb-1.5';
  const inputClass =
    'w-full bg-[#0D0D0F] border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 transition-colors';

  const resizeTable = (newRows: number, newCols: number) => {
    const newCells: string[][] = [];
    for (let r = 0; r < newRows; r++) {
      const row: string[] = [];
      for (let c = 0; c < newCols; c++) {
        row.push(cells[r]?.[c] ?? '');
      }
      newCells.push(row);
    }
    onChange({ ...p, rows: newRows, cols: newCols, cells: newCells });
  };

  const updateCell = (r: number, c: number, value: string) => {
    const newCells = cells.map((row) => [...row]);
    newCells[r][c] = value;
    onChange({ ...p, cells: newCells });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>Rows</label>
          <input
            type="number"
            min={1}
            max={20}
            value={rows}
            onChange={(e) => resizeTable(Math.max(1, parseInt(e.target.value) || 1), cols)}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>Columns</label>
          <input
            type="number"
            min={1}
            max={10}
            value={cols}
            onChange={(e) => resizeTable(rows, Math.max(1, parseInt(e.target.value) || 1))}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(p.headerRow as boolean) ?? true}
            onChange={(e) => onChange({ ...p, headerRow: e.target.checked })}
            className="rounded border-border accent-accent"
          />
          <span className="text-xs text-text-muted">Header row</span>
        </label>
      </div>
      <div>
        <label className={labelClass}>Cell Content</label>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {cells.map((row, ri) =>
            row.map((cell, ci) => (
              <div key={`${ri}-${ci}`} className="flex items-center gap-2">
                <span className="text-[10px] text-text-dim w-12 shrink-0 text-right font-mono">
                  R{ri + 1}C{ci + 1}
                </span>
                <input
                  type="text"
                  value={cell}
                  onChange={(e) => updateCell(ri, ci, e.target.value)}
                  className={inputClass}
                />
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main VisualEditor component
// ---------------------------------------------------------------------------

export function VisualEditor() {
  const router = useRouter();
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [templateName, setTemplateName] = useState('Untitled Template');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draggedPaletteType, setDraggedPaletteType] = useState<ElementType | null>(null);

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;

  // Add element from palette
  const addElement = useCallback((type: ElementType) => {
    const newEl: CanvasElement = {
      id: uid(),
      type,
      props: defaultPropsFor(type),
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
    setShowPreview(false);
    setShowExport(false);
  }, []);

  // Delete element
  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  // Move element up/down
  const moveElement = useCallback((id: string, direction: 'up' | 'down') => {
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  // Update element props
  const updateElementProps = useCallback((id: string, props: ElementProps) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, props } : el)),
    );
  }, []);

  // Export
  const exportedHtml = generateFullHtml(elements);

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(exportedHtml);
  };

  // Save as template
  const handleSave = async () => {
    if (elements.length === 0) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          html_content: exportedHtml,
          sample_data: {},
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Failed to save template');
      }
      const data = await res.json();
      setSaveMessage({ type: 'success', text: 'Template saved!' });
      setTimeout(() => {
        router.push(`/templates/${data.id}`);
      }, 800);
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  // Drag & drop from palette
  const handleCanvasDragOver = (e: React.DragEvent) => {
    if (draggedPaletteType) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedPaletteType) {
      addElement(draggedPaletteType);
      setDraggedPaletteType(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ---------- Left Sidebar: Element Palette ---------- */}
      <aside className="w-[220px] border-r border-border-subtle flex flex-col h-screen sticky top-0 bg-[#0D0D0F]">
        <div className="p-4 border-b border-border-subtle">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Templates
          </Link>
        </div>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[11px] font-semibold text-text-dim uppercase tracking-wider">
            Elements
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="space-y-1">
            {PALETTE.map((item) => (
              <button
                key={item.type}
                draggable
                onDragStart={() => setDraggedPaletteType(item.type)}
                onDragEnd={() => setDraggedPaletteType(null)}
                onClick={() => addElement(item.type)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-primary hover:bg-surface-hover/50 transition-colors cursor-grab active:cursor-grabbing"
              >
                <span className="opacity-70">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-border-subtle">
          <p className="text-[10px] text-text-dim leading-relaxed">
            Click or drag elements onto the canvas to build your template.
          </p>
        </div>
      </aside>

      {/* ---------- Center: Top bar + Canvas ---------- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface">
          <div className="flex items-center gap-3">
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="bg-transparent text-lg font-bold text-text-primary outline-none w-64"
              placeholder="Template name..."
            />
            <span className="text-[11px] text-text-dim px-2 py-0.5 rounded bg-surface-hover">
              {elements.length} element{elements.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span
                className={`text-xs ${saveMessage.type === 'success' ? 'text-green' : 'text-red'}`}
              >
                {saveMessage.text}
              </span>
            )}
            <button
              onClick={() => { setShowExport(!showExport); setShowPreview(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showExport
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <Code size={14} /> Export HTML
            </button>
            <button
              onClick={() => { setShowPreview(!showPreview); setShowExport(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showPreview
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              <Eye size={14} /> Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saving || elements.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-xs font-semibold disabled:opacity-50 transition-opacity"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save as Template'}
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 flex overflow-hidden">
          <div
            className={`${showPreview || showExport ? 'w-1/2' : 'flex-1'} overflow-y-auto`}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
          >
            <div className="max-w-3xl mx-auto py-8 px-6">
              {elements.length === 0 ? (
                <div
                  className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors ${
                    draggedPaletteType
                      ? 'border-accent/50 bg-accent-soft'
                      : 'border-border'
                  }`}
                >
                  <div className="text-3xl mb-3 text-text-dim">+</div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    Start Building
                  </h3>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Click elements from the left palette or drag them onto this
                    canvas to start building your template.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {elements.map((el, idx) => (
                    <CanvasElementView
                      key={el.id}
                      el={el}
                      selected={el.id === selectedId}
                      onSelect={() => {
                        setSelectedId(el.id);
                        setShowPreview(false);
                        setShowExport(false);
                      }}
                      onDelete={() => deleteElement(el.id)}
                      onMoveUp={() => moveElement(el.id, 'up')}
                      onMoveDown={() => moveElement(el.id, 'down')}
                      isFirst={idx === 0}
                      isLast={idx === elements.length - 1}
                    />
                  ))}

                  {/* Drop zone hint at bottom when dragging */}
                  {draggedPaletteType && (
                    <div className="border-2 border-dashed border-accent/40 rounded-lg p-6 text-center bg-accent-soft/50">
                      <span className="text-xs text-accent font-medium">
                        Drop here to add element
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="w-1/2 bg-white flex flex-col border-l border-border-subtle">
              <div className="px-4 py-2 border-b border-gray-200 text-xs text-gray-500 font-medium">
                Preview
              </div>
              <div className="flex-1 overflow-auto p-8">
                {elements.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                    Add elements to see a preview
                  </div>
                ) : (
                  <div
                    className="text-black"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(exportedHtml) }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Export panel */}
          {showExport && (
            <div className="w-1/2 flex flex-col border-l border-border-subtle">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
                <span className="text-xs text-text-dim font-medium">
                  Generated HTML
                </span>
                <button
                  onClick={handleCopyHtml}
                  className="text-[11px] text-accent hover:text-accent/80 font-medium transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
              <textarea
                readOnly
                value={exportedHtml}
                className="flex-1 w-full bg-[#0D0D0F] text-text-muted font-mono text-sm p-4 outline-none resize-none"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </main>

      {/* ---------- Right Sidebar: Properties Panel ---------- */}
      <aside className="w-[280px] border-l border-border-subtle flex flex-col h-screen sticky top-0 bg-[#0D0D0F]">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-[11px] font-semibold text-text-dim uppercase tracking-wider">
            Properties
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {selectedElement ? (
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue/10 text-blue border border-blue/20">
                  {selectedElement.type}
                </span>
              </div>
              <PropertiesPanel
                el={selectedElement}
                onChange={(newProps) => updateElementProps(selectedElement.id, newProps)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center mb-3">
                <Type size={18} className="text-text-dim" />
              </div>
              <p className="text-sm text-text-muted mb-1">No element selected</p>
              <p className="text-[11px] text-text-dim leading-relaxed">
                Click an element on the canvas to edit its properties here.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
