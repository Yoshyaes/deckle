import Handlebars from 'handlebars';
import { sanitizeDataKeys } from '../lib/utils.js';

export function mergeTemplate(htmlContent: string, data: Record<string, unknown>): string {
  const sanitizedData = sanitizeDataKeys(data) as Record<string, unknown>;
  const template = Handlebars.compile(htmlContent);
  return template(sanitizedData);
}
