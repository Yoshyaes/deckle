import React from "react";

export interface DividerProps {
  /** Border thickness. Defaults to "1px". */
  thickness?: string;
  /** Border color. Defaults to "#d1d5db". */
  color?: string;
  /** Vertical margin above and below. Defaults to "16px". */
  spacing?: string;
  /** Additional inline styles applied to the divider */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * A horizontal divider for visually separating sections in a PDF document.
 */
export const Divider: React.FC<DividerProps> = ({
  thickness = "1px",
  color = "#d1d5db",
  spacing = "16px",
  style,
  className,
}) => {
  return (
    <hr
      role="separator"
      aria-orientation="horizontal"
      className={className}
      style={{
        border: "none",
        borderTop: `${thickness} solid ${color}`,
        marginTop: spacing,
        marginBottom: spacing,
        ...style,
      }}
    />
  );
};
