/**
 * Fillable PDF form fields using pdf-lib.
 *
 * Supports filling existing PDF form fields and adding new form fields.
 */
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, rgb } from 'pdf-lib';

interface FormFieldValue {
  name: string;
  value: string | boolean;
}

/**
 * Fill form fields in an existing PDF.
 */
export async function fillFormFields(
  buffer: Buffer,
  fields: FormFieldValue[],
  options?: { flatten?: boolean },
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer);
  const form = doc.getForm();

  for (const field of fields) {
    try {
      if (typeof field.value === 'boolean') {
        const checkbox = form.getCheckBox(field.name);
        if (field.value) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
      } else {
        // Try text field first, then dropdown
        try {
          const textField = form.getTextField(field.name);
          textField.setText(field.value);
        } catch {
          try {
            const dropdown = form.getDropdown(field.name);
            dropdown.select(field.value);
          } catch {
            // Field not found, skip
          }
        }
      }
    } catch {
      // Skip fields that don't exist
    }
  }

  if (options?.flatten) {
    form.flatten();
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * Add form fields to an existing PDF.
 */
interface AddFieldParams {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown';
  page: number; // 0-indexed
  x: number;
  y: number;
  width?: number;
  height?: number;
  options?: string[]; // for dropdown
  defaultValue?: string | boolean;
}

export async function addFormFields(
  buffer: Buffer,
  fieldDefs: AddFieldParams[],
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer);
  const form = doc.getForm();
  const pages = doc.getPages();

  for (const def of fieldDefs) {
    if (def.page < 0 || def.page >= pages.length) continue;
    const page = pages[def.page];

    switch (def.type) {
      case 'text': {
        const field = form.createTextField(def.name);
        field.addToPage(page, {
          x: def.x,
          y: def.y,
          width: def.width || 200,
          height: def.height || 20,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        if (typeof def.defaultValue === 'string') {
          field.setText(def.defaultValue);
        }
        break;
      }
      case 'checkbox': {
        const field = form.createCheckBox(def.name);
        field.addToPage(page, {
          x: def.x,
          y: def.y,
          width: def.width || 15,
          height: def.height || 15,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        if (def.defaultValue === true) {
          field.check();
        }
        break;
      }
      case 'dropdown': {
        const field = form.createDropdown(def.name);
        if (def.options) {
          field.setOptions(def.options);
        }
        field.addToPage(page, {
          x: def.x,
          y: def.y,
          width: def.width || 200,
          height: def.height || 20,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        if (typeof def.defaultValue === 'string') {
          field.select(def.defaultValue);
        }
        break;
      }
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

/**
 * List form fields in a PDF.
 */
export async function listFormFields(buffer: Buffer) {
  const doc = await PDFDocument.load(buffer);
  const form = doc.getForm();
  const fields = form.getFields();

  return fields.map((field) => ({
    name: field.getName(),
    type: field.constructor.name.replace('PDF', '').toLowerCase(),
    readOnly: field.isReadOnly(),
  }));
}
