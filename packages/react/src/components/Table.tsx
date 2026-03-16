import React from "react";

export interface Column<T> {
  /** Property key used to look up the cell value from each data row */
  key: string;
  /** Text displayed in the column header */
  header: string;
  /** Optional CSS width for the column (e.g. "200px", "30%") */
  width?: string;
  /** Horizontal text alignment for both header and body cells */
  align?: "left" | "center" | "right";
  /** Optional custom renderer for the cell. Receives the cell value and full row. */
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T> {
  /** Array of data objects to render as rows */
  data: T[];
  /** Column definitions controlling what is displayed and how */
  columns: Column<T>[];
  /** Alternate row background color for readability. Defaults to false. */
  striped?: boolean;
  /** Show cell borders. Defaults to true. */
  bordered?: boolean;
  /** Additional inline styles applied to the <table> element */
  style?: React.CSSProperties;
  /** Optional CSS class name applied to the outermost element */
  className?: string;
}

/**
 * PDF-friendly data table.
 *
 * Renders a standard HTML `<table>` with configurable columns, optional
 * striped rows, borders, and per-cell custom renderers. Designed to produce
 * clean output when converted to PDF by DocuForge.
 */
export function Table<T extends Record<string, any>>({
  data,
  columns,
  striped = false,
  bordered = true,
  style,
  className,
}: TableProps<T>) {
  const borderStyle = bordered ? "1px solid #d1d5db" : "none";

  return (
    <table
      role="table"
      aria-label="Data table"
      className={className}
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "12px",
        ...style,
      }}
    >
      <thead role="rowgroup">
        <tr role="row">
          {columns.map((col) => (
            <th
              key={col.key}
              role="columnheader"
              scope="col"
              style={{
                padding: "8px 12px",
                textAlign: col.align || "left",
                fontWeight: 600,
                backgroundColor: "#f9fafb",
                borderBottom: "2px solid #d1d5db",
                borderLeft: borderStyle,
                borderRight: borderStyle,
                borderTop: borderStyle,
                width: col.width,
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {data.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            role="row"
            style={{
              backgroundColor:
                striped && rowIndex % 2 === 1 ? "#f9fafb" : "transparent",
            }}
          >
            {columns.map((col) => {
              const value = row[col.key];
              return (
                <td
                  key={col.key}
                  role="cell"
                  style={{
                    padding: "8px 12px",
                    textAlign: col.align || "left",
                    border: borderStyle,
                  }}
                >
                  {col.render ? col.render(value, row) : value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
