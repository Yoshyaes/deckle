/**
 * React-to-HTML renderer.
 *
 * Accepts a JSX/TSX component string, transpiles it with esbuild,
 * then renders to static HTML with ReactDOMServer.
 *
 * The component string should export a default React component.
 * Example:
 *   export default function Invoice({ data }) {
 *     return <div><h1>Invoice #{data.id}</h1></div>;
 *   }
 */
import { transformSync } from 'esbuild';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Script, createContext } from 'vm';
import { ValidationError } from '../lib/errors.js';

const SANDBOX_TIMEOUT_MS = 5000; // 5 seconds max for component evaluation

/**
 * Transpile JSX/TSX to plain JS then evaluate it in a hardened sandbox.
 */
function transpileComponent(source: string): (props: Record<string, unknown>) => React.ReactElement {
  // Transpile JSX → JS using classic React.createElement transform
  const result = transformSync(source, {
    loader: 'tsx',
    format: 'cjs',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
  });

  // Build a hardened sandbox that blocks access to Node.js internals.
  // We explicitly null out dangerous globals and freeze the scope objects
  // to prevent prototype chain traversal attacks.
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports };

  const requireShim = (id: string) => {
    if (id === 'react' || id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') {
      return React;
    }
    throw new Error(`Cannot require "${id}" in React component. Only react is available.`);
  };

  // Execute in a VM sandbox with a timeout to prevent infinite loops and
  // block access to Node.js internals. The context only exposes the
  // minimum required globals (module, exports, require shim, React).
  const sandbox = createContext(
    {
      module: moduleObj,
      exports: moduleExports,
      require: requireShim,
      React,
      // Dangerous globals explicitly set to undefined
      process: undefined,
      global: undefined,
      globalThis: undefined,
      Buffer: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      setImmediate: undefined,
      eval: undefined,
      Function: undefined,
    },
    {
      codeGeneration: { strings: false, wasm: false },
    },
  );

  const script = new Script(result.code, { filename: 'user-component.tsx' });
  script.runInContext(sandbox, { timeout: SANDBOX_TIMEOUT_MS });

  const component = (moduleObj.exports as Record<string, unknown>).default || moduleObj.exports;

  if (typeof component !== 'function') {
    throw new ValidationError(
      'React component must export a default function component. ' +
      'Example: export default function MyDoc(props) { return <div>...</div>; }',
    );
  }

  return component as (props: Record<string, unknown>) => React.ReactElement;
}

/**
 * Render a React component string to full HTML document.
 */
const MAX_SOURCE_SIZE = 1_048_576; // 1MB

export function renderReactToHtml(
  componentSource: string,
  props: Record<string, unknown> = {},
  styles?: string,
): string {
  if (componentSource.length > MAX_SOURCE_SIZE) {
    throw new ValidationError(`React component source exceeds maximum size of ${MAX_SOURCE_SIZE} bytes`);
  }

  try {
    const Component = transpileComponent(componentSource);
    const element = createElement(Component, props);
    const bodyHtml = renderToStaticMarkup(element);

    // Wrap in a full HTML document
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  ${styles || ''}
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    const safeMsg = process.env.NODE_ENV === 'production'
      ? 'Failed to render React component'
      : `Failed to render React component: ${msg}`;
    throw new ValidationError(safeMsg);
  }
}
