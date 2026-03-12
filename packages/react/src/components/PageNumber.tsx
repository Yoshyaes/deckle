import React from "react";

export interface PageNumberProps {
  /** Format string with {{pageNumber}} and {{totalPages}} placeholders. */
  format?: string;
  /** Additional inline styles applied to the page number */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * Renders page number placeholders that the DocuForge API replaces
 * with actual values during PDF generation.
 */
export const PageNumber: React.FC<PageNumberProps> = ({
  format = "Page {{pageNumber}} of {{totalPages}}",
  style,
  className,
}) => {
  return (
    <span
      className={className}
      style={{
        fontSize: "10px",
        color: "#6b7280",
        ...style,
      }}
    >
      {format}
    </span>
  );
};
