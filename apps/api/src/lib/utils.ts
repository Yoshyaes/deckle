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
 *
 * For values that could be arbitrary strings (e.g. a user-supplied property value
 * that is not a color), use this general-purpose sanitizer. For color values
 * specifically, prefer `sanitizeCssColor`.
 */
export function sanitizeCssValue(value: string): string {
  return value.replace(/[;{}\\]/g, '').trim();
}

/**
 * Allowlist-based CSS color sanitizer.
 *
 * Accepts only well-formed color formats:
 *   - Named colors: red, blue, transparent, currentColor …
 *   - Hex:          #rgb, #rrggbb, #rgba, #rrggbbaa
 *   - rgb()/rgba(): rgb(0,0,0) / rgba(0,0,0,0.5)
 *   - hsl()/hsla(): hsl(0,0%,0%) / hsla(0,0%,0%,0.5)
 *
 * Returns the value unchanged if it matches, or falls back to the
 * supplied `fallback` (default: 'rgba(0,0,0,0.08)') for anything
 * that does not match — preventing CSS injection through color fields.
 */
export function sanitizeCssColor(value: string, fallback = 'rgba(0,0,0,0.08)'): string {
  const trimmed = value.trim();
  const COLOR_PATTERN =
    /^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(rgb|rgba|hsl|hsla)\([^)]{0,100}\)|[a-zA-Z]{1,30})$/;
  return COLOR_PATTERN.test(trimmed) ? trimmed : fallback;
}

/**
 * Validate that an object does not exceed a maximum nesting depth.
 * Prevents DoS via deeply nested template data.
 */
export function validateObjectDepth(obj: unknown, maxDepth = 10, currentDepth = 0): void {
  if (currentDepth > maxDepth) {
    throw new Error(`Object nesting exceeds maximum depth of ${maxDepth}`);
  }
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      validateObjectDepth(item, maxDepth, currentDepth + 1);
    }
    return;
  }
  for (const value of Object.values(obj as Record<string, unknown>)) {
    validateObjectDepth(value, maxDepth, currentDepth + 1);
  }
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
