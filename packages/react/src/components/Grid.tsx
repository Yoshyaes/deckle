import React from "react";

export interface GridProps {
  /** Child elements laid out in the grid */
  children: React.ReactNode;
  /** Number of equal-width columns. Defaults to 2. */
  columns?: number;
  /** Gap between grid cells (e.g. "16px", "1rem"). Defaults to "16px". */
  gap?: string;
  /** Additional inline styles applied to the grid container */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * CSS Grid layout wrapper for PDF documents.
 *
 * Creates an equal-column grid using `display: grid`. Useful for placing
 * content side-by-side in invoices, reports, and other structured documents.
 */
export const Grid: React.FC<GridProps> = ({
  children,
  columns = 2,
  gap = "16px",
  style,
  className,
}) => {
  return (
    <div
      role="group"
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
