import { nanoid } from 'nanoid';

export const generateId = (prefix: string, size = 16) =>
  `${prefix}${nanoid(size)}`;

export const genId = () => generateId('gen_');
export const tmplId = () => generateId('tmpl_');
export const apiKeyId = () => generateId('df_live_', 32);
export const userId = () => generateId('usr_');
export const fontId = () => generateId('font_');
