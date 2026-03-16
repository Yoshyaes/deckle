import Handlebars from 'handlebars';
import { sanitizeDataKeys, validateObjectDepth } from '../lib/utils.js';

export function mergeTemplate(htmlContent: string, data: Record<string, unknown>): string {
  const sanitizedData = sanitizeDataKeys(data) as Record<string, unknown>;
  validateObjectDepth(sanitizedData);
  const template = Handlebars.compile(htmlContent, { knownHelpersOnly: true });
  return template(sanitizedData);
}
