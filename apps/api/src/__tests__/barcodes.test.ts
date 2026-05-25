import { describe, it, expect } from 'vitest';
import { processBarcodes } from '../services/barcodes.js';

describe('Barcode and QR code processing', () => {
  describe('QR codes', () => {
    it('replaces {{qr:...}} with SVG', async () => {
      const html = '<div>{{qr:https://example.com}}</div>';
      const result = await processBarcodes(html);
      expect(result).not.toContain('{{qr:');
      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
    });

    it('handles multiple QR codes', async () => {
      const html = '<div>{{qr:abc}} and {{qr:def}}</div>';
      const result = await processBarcodes(html);
      expect(result).not.toContain('{{qr:');
      const svgCount = (result.match(/<svg/g) || []).length;
      expect(svgCount).toBe(2);
    });

    it('passes through HTML without QR placeholders', async () => {
      const html = '<div>No barcodes here</div>';
      const result = await processBarcodes(html);
      expect(result).toBe(html);
    });
  });

  describe('Barcodes', () => {
    it('replaces {{barcode:...}} with SVG', async () => {
      const html = '<div>{{barcode:1234567890}}</div>';
      const result = await processBarcodes(html);
      expect(result).not.toContain('{{barcode:');
      expect(result).toContain('<svg');
      expect(result).toContain('1234567890');
    });

    it('handles multiple barcodes', async () => {
      const html = '{{barcode:AAA}} {{barcode:BBB}}';
      const result = await processBarcodes(html);
      expect(result).not.toContain('{{barcode:');
      const svgCount = (result.match(/<svg/g) || []).length;
      expect(svgCount).toBe(2);
    });

    it('escapes HTML entities in barcode text', async () => {
      const html = '{{barcode:<script>}}';
      const result = await processBarcodes(html);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('Mixed content', () => {
    it('processes both QR and barcode placeholders', async () => {
      const html = '<div>{{qr:hello}} and {{barcode:world}}</div>';
      const result = await processBarcodes(html);
      expect(result).not.toContain('{{qr:');
      expect(result).not.toContain('{{barcode:');
      const svgCount = (result.match(/<svg/g) || []).length;
      expect(svgCount).toBe(2);
    });
  });

  describe('Edge cases and limits', () => {
    it('returns the input unchanged when there are no placeholders', async () => {
      const html = '<html><body><p>plain</p></body></html>';
      const result = await processBarcodes(html);
      expect(result).toBe(html);
    });

    it('caps QR data at MAX_BARCODE_DATA_LENGTH (2048)', async () => {
      const overflow = 'x'.repeat(2049);
      const html = `<div>{{qr:${overflow}}}</div>`;
      const result = await processBarcodes(html);
      expect(result).toContain('[QR data too long]');
      expect(result).not.toContain('<svg');
    });

    it('caps barcode data at MAX_BARCODE_DATA_LENGTH (2048)', async () => {
      const overflow = 'x'.repeat(2049);
      const html = `<div>{{barcode:${overflow}}}</div>`;
      const result = await processBarcodes(html);
      expect(result).toContain('[Barcode data too long]');
      expect(result).not.toContain('<svg');
    });

    it('accepts data exactly at the boundary (2048 chars)', async () => {
      const boundary = 'a'.repeat(2048);
      const html = `<div>{{barcode:${boundary}}}</div>`;
      const result = await processBarcodes(html);
      expect(result).toContain('<svg');
      expect(result).not.toContain('too long');
    });

    it('escapes ampersands and quotes in barcode text', async () => {
      const html = '{{barcode:a&b "c"}}';
      const result = await processBarcodes(html);
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('handles empty QR data without crashing', async () => {
      const html = '<div>{{qr: }}</div>';
      const result = await processBarcodes(html);
      // The QR placeholder must be removed. The qrcode lib may either return an
      // SVG (some versions accept empty input) or the catch-block placeholder.
      expect(result).not.toContain('{{qr:');
      expect(result.includes('<svg') || result.includes('[QR error]')).toBe(true);
    });

    it('preserves surrounding HTML structure', async () => {
      const html = '<header>x</header><div>{{barcode:ABC}}</div><footer>y</footer>';
      const result = await processBarcodes(html);
      expect(result).toContain('<header>x</header>');
      expect(result).toContain('<footer>y</footer>');
    });
  });
});
