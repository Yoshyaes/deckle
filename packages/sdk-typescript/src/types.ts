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
