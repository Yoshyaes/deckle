import {
  DocuForgeOptions,
  GenerateParams,
  GenerateResponse,
  Generation,
  TemplateParams,
  ReactParams,
  BatchParams,
  BatchResponse,
  Template,
  CreateTemplateParams,
  UpdateTemplateParams,
  UsageStats,
  ListResponse,
} from './types.js';
import { DocuForgeError, AuthenticationError, RateLimitError } from './errors.js';

export class DocuForge {
  #apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(apiKey: string, options?: DocuForgeOptions) {
    if (!apiKey) throw new Error('DocuForge API key is required');
    this.#apiKey = apiKey;
    this.baseUrl = (options?.baseUrl ?? 'https://api.docuforge.dev').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 30000;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'docuforge-node/0.1.0',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new DocuForgeError('Request timed out', 0, 'TIMEOUT');
        }
        throw err;
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new DocuForgeError(`Non-JSON response from API (status ${res.status})`, res.status, 'INVALID_RESPONSE');
      }

      if (!res.ok) {
        if (res.status === 401) throw new AuthenticationError(data?.error?.message);
        if (res.status === 429) {
          throw new RateLimitError(
            parseInt(res.headers.get('Retry-After') || '1'),
            data?.error?.message,
          );
        }
        throw new DocuForgeError(
          data?.error?.message || 'Request failed',
          res.status,
          data?.error?.code || 'UNKNOWN',
        );
      }

      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Generate a PDF from raw HTML.
   *
   * @example
   * ```typescript
   * const pdf = await df.generate({
   *   html: '<h1>Invoice #1234</h1>',
   *   options: { format: 'A4', margin: '1in' }
   * });
   * console.log(pdf.url);
   * ```
   */
  async generate(params: GenerateParams): Promise<GenerateResponse> {
    return this.request('POST', '/v1/generate', {
      ...params,
      watermark: params.watermark,
    });
  }

  /**
   * Generate a PDF from a saved template with dynamic data.
   *
   * @example
   * ```typescript
   * const pdf = await df.fromTemplate({
   *   template: 'tmpl_abc123',
   *   data: { name: 'Acme Corp', amount: 500 }
   * });
   * ```
   */
  async fromTemplate(params: TemplateParams): Promise<GenerateResponse> {
    return this.request('POST', '/v1/generate', params);
  }

  /**
   * Generate a PDF from a React component.
   *
   * Pass a JSX/TSX string with a default export function component.
   * Props are passed via the `data` field.
   *
   * @example
   * ```typescript
   * const pdf = await df.fromReact({
   *   react: `
   *     export default function Invoice({ company, total }) {
   *       return (
   *         <div style={{ padding: 40 }}>
   *           <h1>Invoice for {company}</h1>
   *           <p>Total: ${total}</p>
   *         </div>
   *       );
   *     }
   *   `,
   *   data: { company: 'Acme Corp', total: '$1,500' },
   *   options: { format: 'A4' }
   * });
   * ```
   */
  async fromReact(params: ReactParams): Promise<GenerateResponse> {
    return this.request('POST', '/v1/generate', params);
  }

  /**
   * Submit a batch of PDF generation jobs for async processing.
   *
   * @example
   * ```typescript
   * const batch = await df.batch({
   *   items: [
   *     { html: '<h1>Doc 1</h1>' },
   *     { template: 'tmpl_xxx', data: { name: 'Acme' } },
   *   ],
   *   webhook: 'https://example.com/webhook'
   * });
   * // Poll each generation by ID
   * const gen = await df.getGeneration(batch.generations[0].id);
   * ```
   */
  async batch(params: BatchParams): Promise<BatchResponse> {
    return this.request('POST', '/v1/generate/batch', params);
  }

  /**
   * Get a generation by ID.
   */
  async getGeneration(id: string): Promise<Generation> {
    return this.request('GET', `/v1/generations/${id}`);
  }

  /**
   * List recent generations.
   */
  async listGenerations(params?: { limit?: number; offset?: number }): Promise<ListResponse<Generation>> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request('GET', `/v1/generations${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get usage statistics for the current billing period.
   */
  async getUsage(): Promise<UsageStats> {
    return this.request('GET', '/v1/usage');
  }

  /**
   * Template management.
   */
  templates = {
    /**
     * Create a new template.
     */
    create: async (params: CreateTemplateParams): Promise<Template> => {
      return this.request('POST', '/v1/templates', params);
    },

    /**
     * List all templates.
     */
    list: async (): Promise<ListResponse<Template>> => {
      return this.request('GET', '/v1/templates');
    },

    /**
     * Get a template by ID.
     */
    get: async (id: string): Promise<Template> => {
      return this.request('GET', `/v1/templates/${id}`);
    },

    /**
     * Update a template.
     */
    update: async (id: string, params: UpdateTemplateParams): Promise<Template> => {
      return this.request('PUT', `/v1/templates/${id}`, params);
    },

    /**
     * Delete a template.
     */
    delete: async (id: string): Promise<{ deleted: boolean }> => {
      return this.request('DELETE', `/v1/templates/${id}`);
    },
  };
}

// Re-export types and errors
export type {
  GenerateParams,
  GenerateResponse,
  Generation,
  TemplateParams,
  ReactParams,
  BatchParams,
  BatchResponse,
  BatchItem,
  Template,
  CreateTemplateParams,
  UpdateTemplateParams,
  UsageStats,
  PDFOptions,
  DocuForgeOptions,
  ListResponse,
  WatermarkOptions,
} from './types.js';

export { DocuForgeError, AuthenticationError, RateLimitError, ValidationError } from './errors.js';
