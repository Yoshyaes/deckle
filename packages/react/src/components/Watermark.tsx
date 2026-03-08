import React from "react";

export interface WatermarkProps {
  /** Text displayed as the watermark */
  text: string;
  /** Text color. Defaults to "#000000". */
  color?: string;
  /** Opacity from 0 to 1. Defaults to 0.08. */
  opacity?: number;
  /** Rotation angle in degrees. Defaults to -45. */
  angle?: number;
  /** Font size in pixels. Defaults to 72. */
  fontSize?: number;
}

/**
 * Watermark overlay for PDF pages.
 *
 * Renders absolutely-positioned text centered over its containing element
 * (typically a `<Page>`). The text is rotated, semi-transparent, and set to
 * `pointerEvents: "none"` so it does not interfere with selectable content
 * beneath it.
 */
export const Watermark: React.FC<WatermarkProps> = ({
  text,
  color = "#000000",
  opacity = 0.08,
  angle = -45,
  fontSize = 72,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          color,
          opacity,
          transform: `rotate(${angle}deg)`,
          whiteSpace: "nowrap",
          userSelect: "none",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
};
