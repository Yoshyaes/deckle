import { chromium, Browser, BrowserContext } from 'playwright';
import { PDFDocument } from 'pdf-lib';
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

const FORMAT_MAP: Record<string, { width: string; height: string }> = {
  A4: { width: '210mm', height: '297mm' },
  Letter: { width: '8.5in', height: '11in' },
  Legal: { width: '8.5in', height: '14in' },
};

class BrowserPool {
  private browsers: { browser: Browser; usageCount: number }[] = [];
  private maxBrowsers = 3;
  private maxUsagePerBrowser = 100;
  private currentIndex = 0;
  private initializing = false;
  private initPromise: Promise<void> | null = null;

  async initialize() {
    if (this.initPromise) return this.initPromise;
    this.initializing = true;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init() {
    const count = Math.min(2, this.maxBrowsers);
    for (let i = 0; i < count; i++) {
      await this.addBrowser();
    }
    this.initializing = false;
  }

  private async addBrowser() {
    const browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    this.browsers.push({ browser, usageCount: 0 });
  }

  async getBrowser(): Promise<Browser> {
    if (this.browsers.length === 0) {
      await this.initialize();
    }

    // Round-robin selection
    const entry = this.browsers[this.currentIndex % this.browsers.length];
    this.currentIndex++;
    entry.usageCount++;

    // Recycle browser if usage exceeded
    if (entry.usageCount >= this.maxUsagePerBrowser) {
      // Recycle asynchronously but don't use the old browser — schedule replacement
      const idx = this.browsers.indexOf(entry);
      this.recycleBrowser(idx).catch((err) => logger.error({ err }, 'Browser recycle failed'));
    }

    return entry.browser;
  }

  private async recycleBrowser(index: number) {
    const old = this.browsers[index];
    try {
      await old.browser.close();
    } catch {
      // Browser may already be closed
    }

    const browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    this.browsers[index] = { browser, usageCount: 0 };
  }

  async shutdown() {
    await Promise.all(this.browsers.map((b) => b.browser.close().catch(() => {})));
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
  const browser = await browserPool.getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    // JavaScript is disabled, so 'networkidle' would wait unnecessarily for
    // network events that JS would normally trigger. 'load' is equivalent and
    // avoids spurious timeouts on pages that reference external resources.
    await page.setContent(html, { waitUntil: 'load' });

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

    const buffer = await page.pdf(pdfOptions);

    // Use pdf-lib to count pages accurately. The previous regex approach
    // (/\/Type\s*\/Page[^s]/) was fragile for linearised or compressed PDFs.
    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
    } catch {
      // If pdf-lib can't parse it (unusual), fall back to 1 to avoid hard failure
      logger.warn('pdf-lib could not count pages; defaulting to 1');
    }

    return {
      buffer: Buffer.from(buffer),
      pages: pageCount,
      fileSize: buffer.byteLength,
    };
  } finally {
    await context.close();
  }
}
