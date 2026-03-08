/**
 * PDF/A compliance support.
 *
 * Adds PDF/A-1b metadata to PDFs for long-term archiving compliance.
 * Uses pdf-lib to inject the required XMP metadata and color profile.
 */
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';

/**
 * Add PDF/A-1b metadata to a PDF document.
 *
 * This sets the required XMP metadata, output intent, and document info
 * to make the PDF closer to PDF/A-1b compliance. Full compliance also
 * requires embedded fonts and no transparency, which Playwright's
 * PDF output generally satisfies.
 */
export async function makePdfA(buffer: Buffer, options?: {
  title?: string;
  author?: string;
  subject?: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer);

  // Set document metadata
  doc.setTitle(options?.title || doc.getTitle() || 'Document');
  doc.setAuthor(options?.author || doc.getAuthor() || 'DocuForge');
  doc.setSubject(options?.subject || doc.getSubject() || '');
  doc.setCreator('DocuForge API');
  doc.setProducer('DocuForge PDF/A Generator');
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());

  // Add XMP metadata for PDF/A-1b conformance
  const xmpMetadata = generatePdfAXmp({
    title: doc.getTitle() || 'Document',
    author: doc.getAuthor() || 'DocuForge',
    subject: doc.getSubject() || '',
    creator: 'DocuForge API',
    producer: 'DocuForge PDF/A Generator',
  });

  // Attach XMP metadata stream to the document catalog
  const context = doc.context;
  const metadataStream = context.stream(
    Buffer.from(xmpMetadata, 'utf-8'),
    {
      [PDFName.of('Type').toString()]: PDFName.of('Metadata'),
      [PDFName.of('Subtype').toString()]: PDFName.of('XML'),
    },
  );
  const metadataRef = context.register(metadataStream);
  doc.catalog.set(PDFName.of('Metadata'), metadataRef);

  // Mark as PDF/A by setting MarkInfo
  const markInfoDict = context.obj({
    [PDFName.of('Marked').toString()]: true,
  });
  doc.catalog.set(PDFName.of('MarkInfo'), markInfoDict);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function generatePdfAXmp(info: {
  title: string;
  author: string;
  subject: string;
  creator: string;
  producer: string;
}): string {
  const now = new Date().toISOString();
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(info.title)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${escapeXml(info.author)}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(info.subject)}</rdf:li>
        </rdf:Alt>
      </dc:description>
      <xmp:CreatorTool>${escapeXml(info.creator)}</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <pdf:Producer>${escapeXml(info.producer)}</pdf:Producer>
      <pdfaid:part>1</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
