/**
 * React render worker — runs as an isolated child process via child_process.fork().
 *
 * Security model: this process is spawned fresh for each render batch. If user
 * component code escapes the inner vm sandbox, it is still confined to this
 * subprocess and cannot access the main API process's memory, secrets, or
 * file descriptors. The parent kills the child after RENDER_TIMEOUT_MS.
 *
 * Communication: structured messages over the built-in IPC channel.
 */

import { transformSync } from 'esbuild';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Script, createContext } from 'vm';

const SANDBOX_TIMEOUT_MS = 4000;

interface RenderRequest {
  type: 'render';
  componentSource: string;
  props: Record<string, unknown>;
  styles?: string;
}

interface RenderSuccess {
  type: 'success';
  html: string;
}

interface RenderError {
  type: 'error';
  message: string;
  isValidation: boolean;
}

type RenderResponse = RenderSuccess | RenderError;

function transpileAndRender(
  componentSource: string,
  props: Record<string, unknown>,
  styles?: string,
): string {
  // Transpile JSX → JS
  const result = transformSync(componentSource, {
    loader: 'tsx',
    format: 'cjs',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
  });

  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports };

  const requireShim = (id: string) => {
    if (id === 'react' || id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') {
      return React;
    }
    throw new Error(`Cannot require "${id}" in React component. Only react is available.`);
  };

  // Belt-and-suspenders: inner vm context still blocks dangerous globals.
  // The outer process-level isolation (child_process.fork) is the real boundary.
  const sandbox = createContext(
    {
      module: moduleObj,
      exports: moduleExports,
      require: requireShim,
      React,
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
    throw Object.assign(
      new Error(
        'React component must export a default function component. ' +
        'Example: export default function MyDoc(props) { return <div>...</div>; }',
      ),
      { isValidation: true },
    );
  }

  const element = createElement(component as React.FC, props);
  const bodyHtml = renderToStaticMarkup(element);

  // Sanitize styles: strip </style> close tags to prevent escaping the block
  const safeStyles = styles ? styles.replace(/<\/style>/gi, '') : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }
  ${safeStyles}
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

// Listen for render requests from the parent process
process.on('message', (msg: RenderRequest) => {
  if (msg.type !== 'render') return;

  try {
    const html = transpileAndRender(msg.componentSource, msg.props, msg.styles);
    const response: RenderResponse = { type: 'success', html };
    process.send!(response);
  } catch (err) {
    const isValidation = err instanceof Error && !!(err as any).isValidation;
    const message = process.env.NODE_ENV === 'production' && !isValidation
      ? 'Failed to render React component'
      : (err instanceof Error ? err.message : String(err));
    const response: RenderResponse = { type: 'error', message, isValidation };
    process.send!(response);
  }
});

// Signal readiness to the parent
process.send!({ type: 'ready' });
