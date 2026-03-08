import React from "react";

export type PageSize = "A4" | "Letter" | "Legal";
export type PageOrientation = "portrait" | "landscape";

export interface PageProps {
  /** Child elements rendered inside the page */
  children: React.ReactNode;
  /** Predefined page size. Defaults to "A4". */
  size?: PageSize;
  /** Page orientation. Defaults to "portrait". */
  orientation?: PageOrientation;
  /** CSS margin value (e.g. "20mm", "1in 0.75in"). Defaults to "20mm". */
  margin?: string;
  /** Additional inline styles applied to the page container */
  style?: React.CSSProperties;
}

const PAGE_DIMENSIONS: Record<PageSize, { width: string; height: string }> = {
  A4: { width: "210mm", height: "297mm" },
  Letter: { width: "8.5in", height: "11in" },
  Legal: { width: "8.5in", height: "14in" },
};

/**
 * Represents a single page in the PDF document.
 *
 * Renders a `<div>` sized to the chosen paper dimensions with
 * `page-break-after: always` so that each `<Page>` maps to exactly one
 * printed page. Supports A4, Letter, and Legal sizes in either portrait or
 * landscape orientation.
 */
export const Page: React.FC<PageProps> = ({
  children,
  size = "A4",
  orientation = "portrait",
  margin = "20mm",
  style,
}) => {
  const dimensions = PAGE_DIMENSIONS[size];

  const width =
    orientation === "portrait" ? dimensions.width : dimensions.height;
  const height =
    orientation === "portrait" ? dimensions.height : dimensions.width;

  return (
    <div
      style={{
        width,
        minHeight: height,
        margin: "0 auto",
        padding: margin,
        breakInside: "avoid",
        breakAfter: "page",
        boxSizing: "border-box",
        position: "relative",
        backgroundColor: "#ffffff",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
