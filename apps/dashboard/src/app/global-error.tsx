'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0A0A0B', color: '#FAFAFA', fontFamily: 'sans-serif' }}>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: '#A1A1AA', fontSize: 14, marginBottom: 8 }}>
              The dashboard failed to load. This is usually a temporary issue.
            </p>
            {error.digest && (
              <p style={{ color: '#52525B', fontSize: 12, marginBottom: 16 }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #F97316, #EA580C)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
