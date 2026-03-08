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
});
