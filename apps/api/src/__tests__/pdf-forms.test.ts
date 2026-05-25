import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { addFormFields, fillFormFields, listFormFields } from '../services/pdf-forms.js';

async function makeBlankPdf(pageCount = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

describe('addFormFields', () => {
  it('adds a text field that listFormFields can find', async () => {
    const pdf = await makeBlankPdf();
    const out = await addFormFields(pdf, [
      { name: 'first_name', type: 'text', page: 0, x: 50, y: 700 },
    ]);
    const listed = await listFormFields(out);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe('first_name');
    expect(listed[0].type).toContain('text');
  });

  it('adds a checkbox', async () => {
    const pdf = await makeBlankPdf();
    const out = await addFormFields(pdf, [
      { name: 'subscribe', type: 'checkbox', page: 0, x: 50, y: 600, defaultValue: true },
    ]);
    const listed = await listFormFields(out);
    expect(listed.find((f) => f.name === 'subscribe')?.type).toContain('check');
  });

  it('adds a dropdown with options', async () => {
    const pdf = await makeBlankPdf();
    const out = await addFormFields(pdf, [
      {
        name: 'country',
        type: 'dropdown',
        page: 0,
        x: 50, y: 500,
        options: ['US', 'CA', 'UK'],
        defaultValue: 'CA',
      },
    ]);
    const listed = await listFormFields(out);
    expect(listed.find((f) => f.name === 'country')?.type).toContain('drop');
  });

  it('silently skips fields whose page is out of range', async () => {
    const pdf = await makeBlankPdf(2);
    const out = await addFormFields(pdf, [
      { name: 'ok', type: 'text', page: 0, x: 50, y: 700 },
      { name: 'skipped_high', type: 'text', page: 99, x: 50, y: 700 },
      { name: 'skipped_neg', type: 'text', page: -1, x: 50, y: 700 },
    ]);
    const listed = await listFormFields(out);
    const names = listed.map((f) => f.name);
    expect(names).toContain('ok');
    expect(names).not.toContain('skipped_high');
    expect(names).not.toContain('skipped_neg');
  });

  it('applies width/height/defaults when omitted', async () => {
    const pdf = await makeBlankPdf();
    // Just confirm no throw on minimal field spec
    await expect(
      addFormFields(pdf, [{ name: 'tiny', type: 'text', page: 0, x: 10, y: 10 }]),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('adds multiple fields of mixed types in a single call', async () => {
    const pdf = await makeBlankPdf();
    const out = await addFormFields(pdf, [
      { name: 'name', type: 'text', page: 0, x: 50, y: 700 },
      { name: 'agree', type: 'checkbox', page: 0, x: 50, y: 600 },
      { name: 'pick', type: 'dropdown', page: 0, x: 50, y: 500, options: ['a', 'b'] },
    ]);
    const listed = await listFormFields(out);
    expect(listed).toHaveLength(3);
  });
});

describe('fillFormFields', () => {
  it('fills a text field with a string value', async () => {
    const pdf = await makeBlankPdf();
    const withFields = await addFormFields(pdf, [
      { name: 'name', type: 'text', page: 0, x: 50, y: 700 },
    ]);
    const filled = await fillFormFields(withFields, [
      { name: 'name', value: 'Alice' },
    ]);
    const reloaded = await PDFDocument.load(filled);
    const form = reloaded.getForm();
    const tf = form.getTextField('name');
    expect(tf.getText()).toBe('Alice');
  });

  it('checks/unchecks a checkbox', async () => {
    const pdf = await makeBlankPdf();
    const withFields = await addFormFields(pdf, [
      { name: 'agree', type: 'checkbox', page: 0, x: 50, y: 600 },
    ]);
    const checked = await fillFormFields(withFields, [
      { name: 'agree', value: true },
    ]);
    const r1 = await PDFDocument.load(checked);
    expect(r1.getForm().getCheckBox('agree').isChecked()).toBe(true);

    const unchecked = await fillFormFields(checked, [
      { name: 'agree', value: false },
    ]);
    const r2 = await PDFDocument.load(unchecked);
    expect(r2.getForm().getCheckBox('agree').isChecked()).toBe(false);
  });

  it('selects a dropdown option by value', async () => {
    const pdf = await makeBlankPdf();
    const withFields = await addFormFields(pdf, [
      {
        name: 'country',
        type: 'dropdown',
        page: 0,
        x: 50, y: 500,
        options: ['US', 'CA', 'UK'],
      },
    ]);
    const filled = await fillFormFields(withFields, [
      { name: 'country', value: 'CA' },
    ]);
    const reloaded = await PDFDocument.load(filled);
    const dd = reloaded.getForm().getDropdown('country');
    expect(dd.getSelected()).toContain('CA');
  });

  it('skips fields that do not exist (does not throw)', async () => {
    const pdf = await makeBlankPdf();
    const withFields = await addFormFields(pdf, [
      { name: 'real', type: 'text', page: 0, x: 50, y: 700 },
    ]);
    await expect(
      fillFormFields(withFields, [
        { name: 'real', value: 'value' },
        { name: 'missing', value: 'ignored' },
      ]),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('flattens the form when options.flatten is true (form fields disappear)', async () => {
    const pdf = await makeBlankPdf();
    const withFields = await addFormFields(pdf, [
      { name: 'name', type: 'text', page: 0, x: 50, y: 700 },
    ]);
    const flattened = await fillFormFields(
      withFields,
      [{ name: 'name', value: 'Bob' }],
      { flatten: true },
    );
    const listed = await listFormFields(flattened);
    expect(listed).toHaveLength(0);
  });

  it('returns the buffer unchanged in shape when there are no fields to fill', async () => {
    const pdf = await makeBlankPdf();
    const result = await fillFormFields(pdf, []);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.slice(0, 5).toString()).toContain('%PDF');
  });
});

describe('listFormFields', () => {
  it('returns an empty list when the PDF has no form fields', async () => {
    const pdf = await makeBlankPdf();
    expect(await listFormFields(pdf)).toEqual([]);
  });

  it('returns the read-only flag for each field', async () => {
    const pdf = await makeBlankPdf();
    const withFields = await addFormFields(pdf, [
      { name: 'f1', type: 'text', page: 0, x: 50, y: 700 },
    ]);
    const listed = await listFormFields(withFields);
    expect(listed[0]).toHaveProperty('readOnly');
    expect(typeof listed[0].readOnly).toBe('boolean');
  });
});
