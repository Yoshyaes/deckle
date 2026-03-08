/**
 * Shared utility functions.
 */

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safely parse a number from a query string with a default and max bound.
 */
export function safeParseInt(value: string | undefined, defaultVal: number, max: number): number {
  const parsed = parseInt(value || String(defaultVal));
  if (isNaN(parsed) || parsed < 0) return defaultVal;
  return Math.min(parsed, max);
}

/**
 * Sanitize a CSS value to prevent CSS injection via style attributes.
 * Strips semicolons, braces, and other characters that could inject new properties.
 */
export function sanitizeCssValue(value: string): string {
  return value.replace(/[;{}\\]/g, '').trim();
}

/**
 * Recursively strip dangerous keys from an object to prevent prototype pollution.
 */
export function sanitizeDataKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDataKeys);

  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    result[key] = sanitizeDataKeys(value);
  }
  return result;
}
