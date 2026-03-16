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
});
