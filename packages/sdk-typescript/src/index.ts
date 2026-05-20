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
  PdfMergeParams,
  PdfMergeResponse,
  PdfSplitParams,
  PdfSplitResponse,
  PdfInfoParams,
  PdfInfoResponse,
  PdfFillFormParams,
  PdfAddFormFieldsParams,
  PdfListFormFieldsResponse,
  PdfToPdfAParams,
  PdfSignAnnotationParams,
  PdfSignAnnotationResponse,
  MarketplaceTemplate,
  CloneTemplateResponse,
  StarterTemplate,
  AiGenerateTemplateParams,
  AiGenerateTemplateResponse,
  TemplateVersion,
  TemplateVersionsResponse,
} from './types.js';
import { DocuForgeError, AuthenticationError, RateLimitError } from './errors.js';

export class DocuForge {
  #apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(apiKey: string, options?: DocuForgeOptions) {
    if (!apiKey) throw new Error('DocuForge API key is required');
    this.#apiKey = apiKey;
    this.baseUrl = (options?.baseUrl ?? 'https://api.getdocuforge.dev').replace(/\/$/, '');
    this.timeout = options?.timeout ?? 30000;
    this.maxRetries = options?.maxRetries ?? 3;
  }

  /** Status codes that are safe to retry. */
  private static readonly RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
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
          // Retry on retryable status codes (unless we've exhausted attempts)
          if (DocuForge.RETRYABLE_STATUS_CODES.has(res.status) && attempt < this.maxRetries) {
            let delay: number;
            if (res.status === 429) {
              const retryAfterHeader = res.headers.get('Retry-After');
              delay = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 1000 * Math.pow(2, attempt);
            } else {
              delay = 1000 * Math.pow(2, attempt);
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

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
      } catch (err) {
        lastError = err;
        // Don't retry non-retryable errors
        if (err instanceof DocuForgeError || err instanceof AuthenticationError || err instanceof RateLimitError) {
          throw err;
        }
        // Retry network errors
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError;
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

    /**
     * List version history for a template.
     */
    listVersions: async (id: string): Promise<TemplateVersionsResponse> => {
      return this.request('GET', `/v1/templates/${id}/versions`);
    },

    /**
     * Get a specific version's content.
     */
    getVersion: async (id: string, versionId: string): Promise<TemplateVersion> => {
      return this.request('GET', `/v1/templates/${id}/versions/${versionId}`);
    },

    /**
     * Restore a template to a previous version. Creates a new version
     * pointing at the restored content.
     */
    restore: async (id: string, versionId: string): Promise<Template> => {
      return this.request('POST', `/v1/templates/${id}/restore`, {
        version_id: versionId,
      });
    },
  };

  /**
   * PDF-manipulation toolkit. Each method operates on a base64-encoded
   * PDF and returns either a hosted URL or base64 depending on the
   * `output` parameter.
   *
   * Note: `protect` is intentionally NOT exposed — the API endpoint
   * currently returns 501 because the previous implementation did not
   * apply real encryption. `sign` is exposed but its response field is
   * `signature_annotation_added`, not `signed`, to reflect that this
   * is a visual annotation, not a cryptographic signature.
   */
  pdf = {
    /**
     * Merge multiple PDFs into one. Requires at least 2 inputs.
     */
    merge: async (params: PdfMergeParams): Promise<PdfMergeResponse> => {
      return this.request('POST', '/v1/pdf/merge', params);
    },

    /**
     * Split a PDF by page ranges. If `ranges` is omitted, every page is
     * returned as its own PDF.
     */
    split: async (params: PdfSplitParams): Promise<PdfSplitResponse> => {
      return this.request('POST', '/v1/pdf/split', params);
    },

    /**
     * Get metadata (page count, title, author, etc.) about a PDF.
     */
    info: async (params: PdfInfoParams): Promise<PdfInfoResponse> => {
      return this.request('POST', '/v1/pdf/info', params);
    },

    /**
     * Fill named form fields in an existing AcroForm PDF.
     */
    fillForm: async (params: PdfFillFormParams): Promise<PdfMergeResponse> => {
      return this.request('POST', '/v1/pdf/forms/fill', params);
    },

    /**
     * Add text/checkbox/dropdown form fields to a PDF.
     */
    addFormFields: async (params: PdfAddFormFieldsParams): Promise<PdfMergeResponse> => {
      return this.request('POST', '/v1/pdf/forms/add-fields', params);
    },

    /**
     * List the form fields in a PDF.
     */
    listFormFields: async (pdf: string): Promise<PdfListFormFieldsResponse> => {
      return this.request('POST', '/v1/pdf/forms/list-fields', { pdf });
    },

    /**
     * Convert a PDF to PDF/A-1b archival format.
     */
    toPdfA: async (params: PdfToPdfAParams): Promise<PdfMergeResponse> => {
      return this.request('POST', '/v1/pdf/pdfa', params);
    },

    /**
     * Add a visual signature annotation (image overlay + reason /
     * location / contact metadata). NOT a cryptographic signature —
     * the resulting PDF is not tamper-evident. Cryptographic signing
     * is on the roadmap.
     */
    signAnnotation: async (
      params: PdfSignAnnotationParams,
    ): Promise<PdfSignAnnotationResponse> => {
      return this.request('POST', '/v1/pdf/sign', params);
    },
  };

  /**
   * Public template marketplace.
   */
  marketplace = {
    list: async (): Promise<ListResponse<MarketplaceTemplate>> => {
      return this.request('GET', '/v1/marketplace');
    },

    get: async (id: string): Promise<MarketplaceTemplate & { html_content: string }> => {
      return this.request('GET', `/v1/marketplace/${id}`);
    },

    /** Clone a public marketplace template into your own account. */
    clone: async (id: string): Promise<CloneTemplateResponse> => {
      return this.request('POST', `/v1/marketplace/${id}/clone`);
    },

    /** Make one of your own templates publicly cloneable. */
    publish: async (id: string): Promise<{ published: boolean }> => {
      return this.request('POST', `/v1/marketplace/${id}/publish`);
    },

    /** Remove one of your templates from the public marketplace. */
    unpublish: async (id: string): Promise<{ published: boolean }> => {
      return this.request('POST', `/v1/marketplace/${id}/unpublish`);
    },
  };

  /**
   * Pre-built starter templates (no auth required for list/get).
   */
  starterTemplates = {
    list: async (): Promise<ListResponse<StarterTemplate>> => {
      return this.request('GET', '/v1/starter-templates');
    },

    get: async (slug: string): Promise<StarterTemplate> => {
      return this.request('GET', `/v1/starter-templates/${slug}`);
    },

    clone: async (slug: string): Promise<CloneTemplateResponse> => {
      return this.request('POST', `/v1/starter-templates/${slug}/clone`);
    },
  };

  /**
   * Generate a template from a natural-language prompt using the
   * AI-template endpoint. Requires the server to be configured with
   * ANTHROPIC_API_KEY.
   */
  async generateTemplateFromPrompt(
    params: AiGenerateTemplateParams,
  ): Promise<AiGenerateTemplateResponse> {
    return this.request('POST', '/v1/ai/generate-template', params);
  }
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
  PdfMergeParams,
  PdfMergeResponse,
  PdfSplitParams,
  PdfSplitResponse,
  PdfInfoParams,
  PdfInfoResponse,
  PdfFormField,
  PdfFillFormParams,
  PdfFormFieldDef,
  PdfAddFormFieldsParams,
  PdfListFormFieldsResponse,
  PdfToPdfAParams,
  PdfSignAnnotationParams,
  PdfSignAnnotationResponse,
  MarketplaceTemplate,
  CloneTemplateResponse,
  StarterTemplate,
  AiGenerateTemplateParams,
  AiGenerateTemplateResponse,
  TemplateVersion,
  TemplateVersionsResponse,
} from './types.js';

export { DocuForgeError, AuthenticationError, RateLimitError, ValidationError } from './errors.js';
