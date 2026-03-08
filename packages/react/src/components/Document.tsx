import React from "react";

export interface DocumentProps {
  /** Child elements to render inside the document body */
  children: React.ReactNode;
  /** Document title rendered in the <title> tag */
  title?: string;
  /** Custom CSS styles injected into a <style> tag in the document head */
  styles?: string;
}

/**
 * Root wrapper for an entire PDF document.
 *
 * Renders a full HTML structure (`<html>`, `<head>`, `<body>`) that wraps the
 * provided children. Includes charset and viewport meta tags, an optional
 * `<title>`, and an optional `<style>` block. Use this as the outermost
 * component when composing a PDF template with DocuForge.
 */
export const Document: React.FC<DocumentProps> = ({
  children,
  title,
  styles,
}) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {title && <title>{title}</title>}
        {styles && <style dangerouslySetInnerHTML={{ __html: styles }} />}
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          lineHeight: 1.5,
          color: "#1a1a1a",
        }}
      >
        {children}
      </body>
    </html>
  );
};
