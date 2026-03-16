import React from "react";

export interface HeaderProps {
  /** Content rendered inside the header */
  children: React.ReactNode;
  /** Additional inline styles applied to the header container */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * Reusable page header for PDF documents.
 *
 * Renders a styled `<div>` with a bottom border that acts as a visual header
 * area at the top of a page. Place it inside a `<Page>` component before the
 * main content.
 */
export const Header: React.FC<HeaderProps> = ({ children, style, className }) => {
  return (
    <header
      role="banner"
      className={className}
      style={{
        paddingBottom: "10px",
        marginBottom: "20px",
        borderBottom: "2px solid #e5e7eb",
        ...style,
      }}
    >
      {children}
    </header>
  );
};
