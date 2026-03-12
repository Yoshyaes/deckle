import React from "react";

export interface SignatureProps {
  /** Label displayed below the signature line (e.g. "Authorized Signature") */
  label?: string;
  /** CSS width of the signature line. Defaults to "250px". */
  width?: string;
  /** Additional inline styles applied to the outer container */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * Signature line for PDF documents.
 *
 * Renders a horizontal line with an optional label underneath, commonly used
 * for contracts, invoices, and other documents that require a signature area.
 */
export const Signature: React.FC<SignatureProps> = ({
  label = "Signature",
  width = "250px",
  style,
  className,
}) => {
  return (
    <div
      className={className}
      style={{
        display: "inline-block",
        textAlign: "center",
        marginTop: "40px",
        ...style,
      }}
    >
      <div
        style={{
          width,
          borderBottom: "1px solid #1a1a1a",
          marginBottom: "6px",
        }}
      />
      <div
        style={{
          fontSize: "10px",
          color: "#6b7280",
          width,
        }}
      >
        {label}
      </div>
    </div>
  );
};
