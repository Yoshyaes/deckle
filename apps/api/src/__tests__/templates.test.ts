import { describe, it, expect } from 'vitest';
import { mergeTemplate } from '../services/templates.js';

describe('Template merging', () => {
  it('replaces simple variables', () => {
    const html = '<h1>Hello {{name}}</h1>';
    const result = mergeTemplate(html, { name: 'Acme' });
    expect(result).toBe('<h1>Hello Acme</h1>');
  });

  it('handles multiple variables', () => {
    const html = '<p>{{company}} owes ${{amount}}</p>';
    const result = mergeTemplate(html, { company: 'Acme', amount: '500' });
    expect(result).toBe('<p>Acme owes $500</p>');
  });

  it('handles {{#each}} loops', () => {
    const html = '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>';
    const result = mergeTemplate(html, { items: ['A', 'B', 'C'] });
    expect(result).toBe('<ul><li>A</li><li>B</li><li>C</li></ul>');
  });

  it('handles {{#if}} conditionals', () => {
    const html = '{{#if show}}<p>Visible</p>{{/if}}';
    expect(mergeTemplate(html, { show: true })).toBe('<p>Visible</p>');
    expect(mergeTemplate(html, { show: false })).toBe('');
  });

  it('handles nested object access', () => {
    const html = '<p>{{customer.name}} - {{customer.email}}</p>';
    const result = mergeTemplate(html, {
      customer: { name: 'John', email: 'john@example.com' },
    });
    expect(result).toBe('<p>John - john@example.com</p>');
  });

  it('leaves missing variables as empty', () => {
    const html = '<p>Hello {{name}}</p>';
    const result = mergeTemplate(html, {});
    expect(result).toBe('<p>Hello </p>');
  });

  it('escapes HTML in interpolated values by default', () => {
    const html = '<p>{{name}}</p>';
    const result = mergeTemplate(html, { name: '<script>alert(1)</script>' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('emits raw HTML only when explicitly triple-braced ({{{x}}})', () => {
    const html = '<p>{{{html}}}</p>';
    const result = mergeTemplate(html, { html: '<b>bold</b>' });
    expect(result).toBe('<p><b>bold</b></p>');
  });

  it('rejects unknown helpers (knownHelpersOnly is enabled)', () => {
    const html = '{{#weirdHelper x}}{{/weirdHelper}}';
    expect(() => mergeTemplate(html, { x: 1 })).toThrow();
  });

  it('strips __proto__ from data to prevent prototype pollution', () => {
    const html = '<p>{{ok}}</p>';
    // Build malicious data via JSON.parse so __proto__ is a real own-property.
    const data = JSON.parse('{"__proto__":{"polluted":"yes"},"ok":"safe"}');
    const result = mergeTemplate(html, data);
    expect(result).toBe('<p>safe</p>');
    // Confirm Object.prototype was not polluted.
    const probe = {} as Record<string, unknown>;
    expect(probe.polluted).toBeUndefined();
  });

  it('throws when data is nested deeper than the depth limit', () => {
    const html = '<p>{{x}}</p>';
    let inner: unknown = 'leaf';
    for (let i = 0; i < 15; i++) inner = { next: inner };
    expect(() => mergeTemplate(html, { x: inner as object })).toThrow(/depth/);
  });

  it('handles arrays in {{#each}} with index', () => {
    const html = '{{#each items}}{{@index}}:{{this}};{{/each}}';
    const result = mergeTemplate(html, { items: ['a', 'b'] });
    expect(result).toBe('0:a;1:b;');
  });

  it('handles empty string as input', () => {
    const result = mergeTemplate('', { x: 1 });
    expect(result).toBe('');
  });

  it('handles {{else}} branch', () => {
    const html = '{{#if x}}YES{{else}}NO{{/if}}';
    expect(mergeTemplate(html, { x: true })).toBe('YES');
    expect(mergeTemplate(html, { x: false })).toBe('NO');
  });
});
