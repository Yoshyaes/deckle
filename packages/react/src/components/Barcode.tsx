import React from "react";

export interface BarcodeProps {
  /** The data value encoded in the barcode or QR code */
  value: string;
  /** Type of code to render. Defaults to "qr". */
  type?: "qr" | "barcode";
  /** Width in pixels. Defaults to 150 for QR codes, 200 for barcodes. */
  width?: number;
  /** Height in pixels. Defaults to 150 for QR codes, 80 for barcodes. */
  height?: number;
}

/**
 * Barcode / QR code placeholder for DocuForge PDF generation.
 *
 * Renders a `{{qr:value}}` or `{{barcode:value}}` placeholder string inside
 * a sized container. The DocuForge API replaces these placeholders with actual
 * barcode or QR code images during server-side PDF rendering.
 */
export const Barcode: React.FC<BarcodeProps> = ({
  value,
  type = "qr",
  width,
  height,
}) => {
  const defaultWidth = type === "qr" ? 150 : 200;
  const defaultHeight = type === "qr" ? 150 : 80;

  const resolvedWidth = width ?? defaultWidth;
  const resolvedHeight = height ?? defaultHeight;

  const placeholder =
    type === "qr" ? `{{qr:${value}}}` : `{{barcode:${value}}}`;

  return (
    <div
      style={{
        display: "inline-block",
        width: `${resolvedWidth}px`,
        height: `${resolvedHeight}px`,
        textAlign: "center",
        lineHeight: `${resolvedHeight}px`,
        fontSize: "12px",
        fontFamily: "monospace",
      }}
    >
      {placeholder}
    </div>
  );
};
