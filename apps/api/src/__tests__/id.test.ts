import { describe, it, expect } from 'vitest';
import { generateId, genId, tmplId, apiKeyId, userId, fontId } from '../lib/id.js';

describe('ID generation', () => {
  it('generates IDs with correct prefixes', () => {
    expect(genId()).toMatch(/^gen_/);
    expect(tmplId()).toMatch(/^tmpl_/);
    expect(apiKeyId()).toMatch(/^df_live_/);
    expect(userId()).toMatch(/^usr_/);
    expect(fontId()).toMatch(/^font_/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => genId()));
    expect(ids.size).toBe(100);
  });

  it('generates IDs of expected length', () => {
    const id = generateId('test_', 16);
    expect(id).toHaveLength(5 + 16); // prefix + nanoid
  });

  it('apiKeyId is 40 chars (df_live_ prefix + 32 chars)', () => {
    const key = apiKeyId();
    expect(key.startsWith('df_live_')).toBe(true);
    expect(key.length).toBe(8 + 32); // df_live_ = 8 chars + 32 nanoid
  });

  it('generateId respects custom size argument', () => {
    expect(generateId('x_', 8)).toHaveLength(2 + 8);
    expect(generateId('x_', 32)).toHaveLength(2 + 32);
  });

  it('generateId default size is 16', () => {
    expect(generateId('x_')).toHaveLength(2 + 16);
  });

  it('generateId accepts empty prefix', () => {
    const id = generateId('', 16);
    expect(id).toHaveLength(16);
  });

  it('all helper IDs are unique across many invocations', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      ids.add(genId());
      ids.add(tmplId());
      ids.add(apiKeyId());
      ids.add(userId());
      ids.add(fontId());
    }
    expect(ids.size).toBe(200 * 5);
  });

  it('API keys use a URL-safe alphabet (no slashes, plus, equals)', () => {
    for (let i = 0; i < 25; i++) {
      const key = apiKeyId();
      expect(key).not.toMatch(/[/+=]/);
    }
  });

  it('generated IDs contain no whitespace', () => {
    for (let i = 0; i < 25; i++) {
      expect(genId()).not.toMatch(/\s/);
    }
  });
});
