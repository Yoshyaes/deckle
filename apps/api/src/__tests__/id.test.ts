import { describe, it, expect } from 'vitest';
import { generateId, genId, tmplId, apiKeyId, userId } from '../lib/id.js';

describe('ID generation', () => {
  it('generates IDs with correct prefixes', () => {
    expect(genId()).toMatch(/^gen_/);
    expect(tmplId()).toMatch(/^tmpl_/);
    expect(apiKeyId()).toMatch(/^df_live_/);
    expect(userId()).toMatch(/^usr_/);
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
});
