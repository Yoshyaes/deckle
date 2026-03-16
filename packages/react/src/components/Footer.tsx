import React from "react";

export interface FooterProps {
  /** Content rendered inside the footer */
  children: React.ReactNode;
  /** Additional inline styles applied to the footer container */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * Reusable page footer for PDF documents.
 *
 * Renders a styled `<div>` positioned at the bottom of its containing page.
 * Uses absolute positioning so the footer sticks to the page bottom regardless
 * of how much content precedes it. Place it inside a `<Page>` component.
 */
export const Footer: React.FC<FooterProps> = ({ children, style, className }) => {
  return (
    <footer
      role="contentinfo"
      className={className}
      style={{
        position: "absolute",
        bottom: "20mm",
        left: "20mm",
        right: "20mm",
        paddingTop: "10px",
        borderTop: "1px solid #e5e7eb",
        fontSize: "10px",
        color: "#6b7280",
        ...style,
      }}
    >
      {children}
    </footer>
  );
};
