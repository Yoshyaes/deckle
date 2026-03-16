import React from "react";

export interface ListProps {
  /** Array of items to render in the list. */
  items: (string | React.ReactNode)[];
  /** Render as an ordered list (<ol>) instead of unordered (<ul>). Defaults to false. */
  ordered?: boolean;
  /** Additional inline styles applied to the list element. */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element. */
  className?: string;
}

/**
 * A styled list component for rendering ordered or unordered lists in a PDF document.
 */
export const List: React.FC<ListProps> = ({
  items,
  ordered = false,
  style,
  className,
}) => {
  const Tag = ordered ? "ol" : "ul";

  return (
    <Tag
      role="list"
      className={className}
      style={{
        fontSize: "12px",
        lineHeight: 1.6,
        color: "#1a1a1a",
        paddingLeft: "24px",
        margin: 0,
        ...style,
      }}
    >
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  );
};
