import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  safeParseInt,
  sanitizeCssValue,
  sanitizeCssColor,
  validateObjectDepth,
  sanitizeDataKeys,
} from '../lib/utils.js';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes < and >', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes all dangerous chars in a single string', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('escapes ampersand before other entities so output is safe', () => {
    // & must be escaped first so we don't double-escape already-escaped entities
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('safeParseInt', () => {
  it('returns default for undefined', () => {
    expect(safeParseInt(undefined, 10, 100)).toBe(10);
  });

  it('returns parsed value when in bounds', () => {
    expect(safeParseInt('42', 10, 100)).toBe(42);
  });

  it('clamps to max', () => {
    expect(safeParseInt('500', 10, 100)).toBe(100);
  });

  it('returns default when NaN', () => {
    expect(safeParseInt('not-a-number', 10, 100)).toBe(10);
  });

  it('returns default for negative input', () => {
    expect(safeParseInt('-5', 10, 100)).toBe(10);
  });

  it('returns default for empty string', () => {
    expect(safeParseInt('', 10, 100)).toBe(10);
  });

  it('accepts zero', () => {
    expect(safeParseInt('0', 10, 100)).toBe(0);
  });

  it('accepts the boundary value (max)', () => {
    expect(safeParseInt('100', 10, 100)).toBe(100);
  });
});

describe('sanitizeCssValue', () => {
  it('strips semicolons', () => {
    expect(sanitizeCssValue('red;color:blue')).toBe('redcolor:blue');
  });

  it('strips braces', () => {
    expect(sanitizeCssValue('{ malicious }')).toBe('malicious');
  });

  it('strips backslashes', () => {
    expect(sanitizeCssValue('foo\\bar')).toBe('foobar');
  });

  it('trims whitespace', () => {
    expect(sanitizeCssValue('   red   ')).toBe('red');
  });

  it('passes plain values through unchanged', () => {
    expect(sanitizeCssValue('16px')).toBe('16px');
  });
});

describe('sanitizeCssColor', () => {
  it('accepts named colors', () => {
    expect(sanitizeCssColor('red')).toBe('red');
    expect(sanitizeCssColor('transparent')).toBe('transparent');
    expect(sanitizeCssColor('currentColor')).toBe('currentColor');
  });

  it('accepts hex shorthand and longhand', () => {
    expect(sanitizeCssColor('#fff')).toBe('#fff');
    expect(sanitizeCssColor('#ffffff')).toBe('#ffffff');
    expect(sanitizeCssColor('#ffffffaa')).toBe('#ffffffaa');
  });

  it('accepts rgb and rgba', () => {
    expect(sanitizeCssColor('rgb(0,0,0)')).toBe('rgb(0,0,0)');
    expect(sanitizeCssColor('rgba(255, 255, 255, 0.5)')).toBe('rgba(255, 255, 255, 0.5)');
  });

  it('accepts hsl and hsla', () => {
    expect(sanitizeCssColor('hsl(120, 50%, 50%)')).toBe('hsl(120, 50%, 50%)');
    expect(sanitizeCssColor('hsla(120, 50%, 50%, 0.5)')).toBe('hsla(120, 50%, 50%, 0.5)');
  });

  it('rejects CSS injection attempts (semicolons, braces)', () => {
    expect(sanitizeCssColor('red; background: url(http://evil)')).toBe('rgba(0,0,0,0.08)');
    expect(sanitizeCssColor('}{ ')).toBe('rgba(0,0,0,0.08)');
  });

  it('rejects expression() and url()', () => {
    expect(sanitizeCssColor('expression(alert(1))')).toBe('rgba(0,0,0,0.08)');
    expect(sanitizeCssColor('url(http://evil)')).toBe('rgba(0,0,0,0.08)');
  });

  it('uses supplied fallback when provided', () => {
    expect(sanitizeCssColor('bad}', '#000')).toBe('#000');
  });

  it('trims whitespace before matching', () => {
    expect(sanitizeCssColor('   red   ')).toBe('red');
  });
});

describe('validateObjectDepth', () => {
  it('accepts shallow object', () => {
    expect(() => validateObjectDepth({ a: 1 })).not.toThrow();
  });

  it('accepts deep but under-limit nesting', () => {
    const obj: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = obj;
    for (let i = 0; i < 9; i++) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => validateObjectDepth(obj, 10)).not.toThrow();
  });

  it('throws when depth exceeded', () => {
    const obj: Record<string, unknown> = {};
    let cursor: Record<string, unknown> = obj;
    for (let i = 0; i < 15; i++) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => validateObjectDepth(obj, 10)).toThrow(/exceeds maximum depth/);
  });

  it('walks into arrays', () => {
    let inner: unknown = 'leaf';
    for (let i = 0; i < 15; i++) inner = [inner];
    expect(() => validateObjectDepth(inner, 10)).toThrow();
  });

  it('treats null and primitives as depth 0', () => {
    expect(() => validateObjectDepth(null)).not.toThrow();
    expect(() => validateObjectDepth('string')).not.toThrow();
    expect(() => validateObjectDepth(42)).not.toThrow();
  });
});

describe('sanitizeDataKeys', () => {
  // Build payloads via JSON.parse so the keys are real own-properties,
  // not the JS-special prototype setter used by object literals.
  it('strips __proto__ own-property', () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"real":1}');
    const cleaned = sanitizeDataKeys(input) as Record<string, unknown>;
    expect(cleaned.real).toBe(1);
    expect(Object.hasOwn(cleaned, '__proto__')).toBe(false);
  });

  it('strips constructor and prototype own-properties', () => {
    const cleaned = sanitizeDataKeys({
      constructor: 'bad',
      prototype: 'bad',
      keep: 'ok',
    }) as Record<string, unknown>;
    expect(cleaned.keep).toBe('ok');
    expect(Object.hasOwn(cleaned, 'constructor')).toBe(false);
    expect(Object.hasOwn(cleaned, 'prototype')).toBe(false);
  });

  it('recurses into nested objects', () => {
    const input = JSON.parse('{"nested":{"__proto__":{"x":1},"ok":true}}');
    const cleaned = sanitizeDataKeys(input) as { nested: Record<string, unknown> };
    expect(cleaned.nested.ok).toBe(true);
    expect(Object.hasOwn(cleaned.nested, '__proto__')).toBe(false);
  });

  it('recurses into arrays', () => {
    const input = JSON.parse('[{"__proto__":{"x":1},"keep":1}]');
    const cleaned = sanitizeDataKeys(input) as Array<Record<string, unknown>>;
    expect(cleaned[0].keep).toBe(1);
    expect(Object.hasOwn(cleaned[0], '__proto__')).toBe(false);
  });

  it('passes primitives through', () => {
    expect(sanitizeDataKeys('hello')).toBe('hello');
    expect(sanitizeDataKeys(42)).toBe(42);
    expect(sanitizeDataKeys(null)).toBe(null);
    expect(sanitizeDataKeys(undefined)).toBe(undefined);
  });

  it('does not mutate input', () => {
    const input = JSON.parse('{"keep":1,"__proto__":{"bad":true}}');
    sanitizeDataKeys(input);
    expect(Object.hasOwn(input, '__proto__')).toBe(true);
  });

  it('actual prototype pollution attempt is blocked', () => {
    // Simulate a malicious JSON payload over the wire.
    const payload = JSON.parse('{"__proto__":{"polluted":"yes"}}');
    sanitizeDataKeys(payload);
    // Object.prototype should not have been polluted.
    const probe = {} as Record<string, unknown>;
    expect(probe.polluted).toBeUndefined();
  });
});
