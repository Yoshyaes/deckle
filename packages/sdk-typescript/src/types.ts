export interface PDFOptions {
  format?: 'A4' | 'Letter' | 'Legal' | { width: string; height: string };
  margin?: string | { top?: string; right?: string; bottom?: string; left?: string };
  orientation?: 'portrait' | 'landscape';
  header?: string;
  footer?: string;
  printBackground?: boolean;
}

export interface GenerateParams {
  html: string;
  options?: PDFOptions;
  output?: 'url' | 'base64';
  webhook?: string;
  watermark?: WatermarkOptions;
}

export interface ReactParams {
  react: string;
  data?: Record<string, any>;
  styles?: string;
  options?: PDFOptions;
  output?: 'url' | 'base64';
  webhook?: string;
}

export interface TemplateParams {
  template: string;
  data: Record<string, any>;
  options?: PDFOptions;
  output?: 'url' | 'base64';
  webhook?: string;
}

export interface GenerateResponse {
  id: string;
  status: 'completed' | 'failed';
  url?: string;
  data?: string;
  pages: number;
  file_size: number;
  generation_time_ms: number;
}

export interface Generation {
  id: string;
  template_id: string | null;
  input_type: 'html' | 'template';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  url: string | null;
  pages: number | null;
  file_size: number | null;
  generation_time_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  html_content?: string;
  schema?: Record<string, unknown>;
  version: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateParams {
  name: string;
  html_content: string;
  schema?: Record<string, unknown>;
  is_public?: boolean;
}

export interface UpdateTemplateParams {
  name?: string;
  html_content?: string;
  schema?: Record<string, unknown>;
  is_public?: boolean;
}

export interface UsageStats {
  period_start: string;
  period_end: string;
  generation_count: number;
  total_pages: number;
  total_bytes: number;
  plan: string;
  limit: number;
}

export interface ListResponse<T> {
  data: T[];
  has_more: boolean;
}

export interface BatchItem {
  html?: string;
  react?: string;
  template?: string;
  data?: Record<string, any>;
  styles?: string;
  options?: PDFOptions;
  output?: 'url' | 'base64';
}

export interface BatchParams {
  items: BatchItem[];
  webhook?: string;
}

export interface BatchResponse {
  batch_id: string;
  total: number;
  generations: { id: string; index: number }[];
  status: 'queued';
}

export interface WatermarkOptions {
  text?: string;
  color?: string;
  opacity?: number;
  angle?: number;
  fontSize?: number;
}

export interface DocuForgeOptions {
  baseUrl?: string;
  timeout?: number;
  /** Maximum number of retries for failed requests (429/5xx). Defaults to 3. */
  maxRetries?: number;
}

// ── PDF tools ────────────────────────────────────────────────────────

export interface PdfMergeParams {
  /** Base64-encoded PDFs. Must include at least 2 items. */
  pdfs: string[];
  output?: 'url' | 'base64';
}

export interface PdfMergeResponse {
  url?: string;
  data?: string;
  file_size: number;
}

export interface PdfSplitParams {
  /** Base64-encoded PDF. */
  pdf: string;
  /** Optional page ranges. Each entry is [start] (single page) or [start, end] (inclusive, 1-indexed). */
  ranges?: number[][];
  output?: 'url' | 'base64';
}

export interface PdfSplitResponse {
  parts: Array<{ url?: string; data?: string; file_size: number }>;
  total: number;
}

export interface PdfInfoParams {
  pdf: string;
}

export interface PdfInfoResponse {
  pages: number;
  fileSize?: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface PdfFormField {
  name: string;
  value: string | boolean;
}

export interface PdfFillFormParams {
  pdf: string;
  fields: PdfFormField[];
  flatten?: boolean;
  output?: 'url' | 'base64';
}

export interface PdfFormFieldDef {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown';
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  options?: string[];
  defaultValue?: string | boolean;
}

export interface PdfAddFormFieldsParams {
  pdf: string;
  fields: PdfFormFieldDef[];
  output?: 'url' | 'base64';
}

export interface PdfListFormFieldsResponse {
  fields: Array<{ name: string; type: string; value?: unknown }>;
  total: number;
}

export interface PdfToPdfAParams {
  pdf: string;
  title?: string;
  author?: string;
  subject?: string;
  output?: 'url' | 'base64';
}

export interface PdfSignAnnotationParams {
  pdf: string;
  name: string;
  reason?: string;
  location?: string;
  contact?: string;
  page?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  output?: 'url' | 'base64';
}

export interface PdfSignAnnotationResponse {
  url?: string;
  data?: string;
  file_size: number;
  /**
   * Visual annotation only — not a cryptographic signature. See
   * docs/api-reference/pdf-sign for the security implications.
   */
  signature_annotation_added: boolean;
}

export interface PdfProtectPermissions {
  /** Print quality allowed: 'none' (deny), 'low' (degraded), 'full' (high-res). Default: 'full'. */
  print?: 'none' | 'low' | 'full';
  /** Allow edits/annotations/form fill. Default: false. */
  modify?: boolean;
  /** Allow text/image copying. Default: true. */
  copy?: boolean;
  /** Allow adding annotations even when modify=false. Default: false. */
  annotate?: boolean;
}

export interface PdfProtectParams {
  pdf: string;
  /** Required to open the PDF. At least one of user_password or owner_password must be set. */
  user_password?: string;
  /** Required to strip restrictions. If omitted, mirrors user_password. */
  owner_password?: string;
  permissions?: PdfProtectPermissions;
  output?: 'url' | 'base64';
}

export interface PdfProtectResponse {
  url?: string;
  data?: string;
  file_size: number;
  encrypted: true;
  encryption: 'AES-256';
}

// ── Marketplace ──────────────────────────────────────────────────────

export interface MarketplaceTemplate {
  id: string;
  name: string;
  version: number;
  user_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloneTemplateResponse {
  id: string;
  name: string;
  version: number;
  created_at: string;
}

// ── Starter templates ───────────────────────────────────────────────

export interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  sample_data?: Record<string, unknown>;
  html_content?: string;
}

// ── AI template generation ──────────────────────────────────────────

export interface AiGenerateTemplateParams {
  prompt: string;
  variables?: string[];
}

export interface AiGenerateTemplateResponse {
  html_content: string;
  variables: string[];
  notes?: string;
}

// ── Template versions ───────────────────────────────────────────────

export interface TemplateVersion {
  id: string;
  version: number;
  created_at: string;
  html_content?: string;
  schema?: Record<string, unknown>;
}

export interface TemplateVersionsResponse {
  current_version: number;
  data: TemplateVersion[];
}
