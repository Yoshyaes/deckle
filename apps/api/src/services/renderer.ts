import { chromium, Browser, BrowserContext } from 'playwright';
import { logger } from '../lib/logger.js';

interface RenderOptions {
  format?: 'A4' | 'Letter' | 'Legal' | { width: string; height: string };
  margin?: string | { top?: string; right?: string; bottom?: string; left?: string };
  orientation?: 'portrait' | 'landscape';
  header?: string;
  footer?: string;
  printBackground?: boolean;
}

interface RenderResult {
  buffer: Buffer;
  pages: number;
  fileSize: number;
}

interface BrowserEntry {
  browser: Browser;
  usageCount: number;
  inFlight: number;
  recycling: boolean;
}

const FORMAT_MAP: Record<string, { width: string; height: string }> = {
  A4: { width: '210mm', height: '297mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
};

const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const SET_CONTENT_TIMEOUT_MS = 15_000;
const PDF_TIMEOUT_MS = 30_000;
const SHUTDOWN_DRAIN_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

class BrowserPool {
  private browsers: BrowserEntry[] = [];
  private maxBrowsers = 3;
  // Lowered from 100 to 20 per audit-02: with --no-sandbox Chromium
  // and a shared browser pool, a cross-tenant Chromium-bug exploit
  // can compromise the next user's render. Recycling every ~20
  // renders reduces the blast radius significantly without
  // dominating end-to-end latency (a fresh browser launch is ~600ms
  // and amortizes over 20 renders ≈ +30ms each).
  private maxUsagePerBrowser = 20;
  private currentIndex = 0;
  private initPromise: Promise<void> | null = null;
  private shuttingDown = false;

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    const count = Math.min(2, this.maxBrowsers);
    for (let i = 0; i < count; i++) {
      await this.addBrowser();
    }
  }

  private async addBrowser(): Promise<void> {
    const browser = await chromium.launch({ args: CHROMIUM_ARGS });
    this.browsers.push({ browser, usageCount: 0, inFlight: 0, recycling: false });
  }

  /**
   * Acquire a fresh context for one render. Caller MUST invoke `release`
   * in a finally block so the per-browser in-flight counter drops and
   * recycling can proceed safely.
   */
  async acquireContext(): Promise<{
    context: BrowserContext;
    release: () => Promise<void>;
  }> {
    if (this.shuttingDown) {
      throw new Error('Renderer is shutting down; refusing new render');
    }
    if (this.browsers.length === 0) {
      await this.initialize();
    }

    // Round-robin skipping entries that are mid-recycle. If all are
    // recycling (rare), wait briefly and retry.
    const entry = this.pickEntry();
    if (!entry) {
      // Brief backoff, then one retry.
      await new Promise((r) => setTimeout(r, 50));
      const retry = this.pickEntry();
      if (!retry) {
        throw new Error('All browsers are recycling; backpressure exhausted');
      }
      return this.checkout(retry);
    }
    return this.checkout(entry);
  }

  private pickEntry(): BrowserEntry | null {
    for (let i = 0; i < this.browsers.length; i++) {
      const candidate = this.browsers[this.currentIndex % this.browsers.length];
      this.currentIndex++;
      if (!candidate.recycling) return candidate;
    }
    return null;
  }

  private async checkout(entry: BrowserEntry) {
    entry.usageCount++;
    entry.inFlight++;
    const context = await entry.browser.newContext({ javaScriptEnabled: false });

    const release = async () => {
      try {
        await context.close();
      } catch (err) {
        logger.warn({ err }, 'Failed to close browser context cleanly');
      } finally {
        entry.inFlight--;
        if (
          !this.shuttingDown &&
          entry.usageCount >= this.maxUsagePerBrowser &&
          entry.inFlight === 0 &&
          !entry.recycling
        ) {
          const idx = this.browsers.indexOf(entry);
          if (idx !== -1) {
            this.recycleBrowser(idx).catch((err) =>
              logger.error({ err }, 'Browser recycle failed'),
            );
          }
        }
      }
    };

    return { context, release };
  }

  private async recycleBrowser(index: number): Promise<void> {
    const old = this.browsers[index];
    if (!old || old.recycling) return;
    old.recycling = true;

    try {
      await old.browser.close();
    } catch {
      // Browser may already be closed by a previous error.
    }

    try {
      const browser = await chromium.launch({ args: CHROMIUM_ARGS });
      this.browsers[index] = {
        browser,
        usageCount: 0,
        inFlight: 0,
        recycling: false,
      };
    } catch (err) {
      logger.error({ err }, 'Failed to launch replacement browser; removing slot');
      this.browsers.splice(index, 1);
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    const deadline = Date.now() + SHUTDOWN_DRAIN_MS;

    // Wait for in-flight renders to complete before closing browsers.
    while (Date.now() < deadline) {
      const inFlight = this.browsers.reduce((sum, e) => sum + e.inFlight, 0);
      if (inFlight === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    await Promise.all(
      this.browsers.map((b) =>
        b.browser.close().catch((err) =>
          logger.warn({ err }, 'Failed to close browser on shutdown'),
        ),
      ),
    );
    this.browsers = [];
  }
}

export const browserPool = new BrowserPool();

function parseMargin(margin: RenderOptions['margin']) {
  if (!margin) return { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' };
  if (typeof margin === 'string') {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }
  return {
    top: margin.top || '0.5in',
    right: margin.right || '0.5in',
    bottom: margin.bottom || '0.5in',
    left: margin.left || '0.5in',
  };
}

function interpolatePageVars(html: string): string {
  // Playwright uses its own class-based system for page numbers in headers/footers
  return html
    .replace(/\{\{pageNumber\}\}/g, '<span class="pageNumber"></span>')
    .replace(/\{\{totalPages\}\}/g, '<span class="totalPages"></span>');
}

export async function renderPdf(html: string, options: RenderOptions = {}): Promise<RenderResult> {
  const { context, release } = await browserPool.acquireContext();
  const page = await context.newPage();

  try {
    // Bound the time we wait for content to finish loading. Without this
    // a hung <img>/<script> request keeps a pool slot busy indefinitely.
    await withTimeout(
      page.setContent(html, { waitUntil: 'networkidle', timeout: SET_CONTENT_TIMEOUT_MS }),
      SET_CONTENT_TIMEOUT_MS + 1_000,
      'page.setContent',
    );

    const format = options.format || 'A4';
    const dimensions = typeof format === 'string' ? FORMAT_MAP[format] : format;
    const margin = parseMargin(options.margin);
    const landscape = options.orientation === 'landscape';

    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      width: dimensions?.width,
      height: dimensions?.height,
      margin,
      landscape,
      printBackground: options.printBackground ?? true,
    };

    if (options.header) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = interpolatePageVars(options.header);
    }

    if (options.footer) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.footerTemplate = interpolatePageVars(options.footer);
    }

    // Set default empty templates when only one is provided
    if (pdfOptions.displayHeaderFooter) {
      if (!options.header) pdfOptions.headerTemplate = '<span></span>';
      if (!options.footer) pdfOptions.footerTemplate = '<span></span>';
    }

    const buffer = await withTimeout(page.pdf(pdfOptions), PDF_TIMEOUT_MS, 'page.pdf');

    // Count pages by looking for PDF page markers
    const pdfContent = buffer.toString('latin1');
    const pageCount = (pdfContent.match(/\/Type\s*\/Page[^s]/g) || []).length;

    return {
      buffer: Buffer.from(buffer),
      pages: pageCount || 1,
      fileSize: buffer.byteLength,
    };
  } finally {
    await release();
  }
}
