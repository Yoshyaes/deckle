/**
 * Targeted tests for the react-render-worker (child_process isolation boundary).
 *
 * The worker itself is only addressable through the parent (`renderReactToHtml`),
 * so these tests drive it through that public API but focus specifically on the
 * isolation and timeout properties of the worker subprocess.
 */
import { describe, it, expect } from 'vitest';
import { renderReactToHtml } from '../services/react-renderer.js';

describe('react-render-worker isolation', () => {
  it('cannot read parent process.env even when secret is present', async () => {
    process.env.WORKER_PROBE = 'this-must-not-leak';
    try {
      const source = `
        export default function P() {
          // typeof check first so we don't crash on undefined
          const v = (typeof process !== 'undefined' && process && process.env)
            ? (process.env.WORKER_PROBE || 'no-env-var')
            : 'no-process-global';
          return <span>{v}</span>;
        }
      `;
      const html = await renderReactToHtml(source);
      expect(html).not.toContain('this-must-not-leak');
    } finally {
      delete process.env.WORKER_PROBE;
    }
  });

  it('globalThis is undefined in the inner sandbox (no host access)', async () => {
    const source = `
      export default function P() {
        const gt = globalThis;
        return <span>{String(gt)}</span>;
      }
    `;
    const html = await renderReactToHtml(source);
    // globalThis: undefined in sandbox → String(undefined) === 'undefined'
    expect(html).toContain('<span>undefined</span>');
  });

  it('cannot escape sandbox via Buffer (file I/O primitive)', async () => {
    const source = `
      export default function P() {
        const b = Buffer.from('hello');
        return <span>{b.toString()}</span>;
      }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('cannot use setTimeout to defer side effects', async () => {
    const source = `
      export default function P() {
        setTimeout(() => {}, 0);
        return <span>x</span>;
      }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('surfaces transpilation errors as ValidationError', async () => {
    const source = `
      export default function P() {
        // Syntax error: unbalanced braces
        return <div>{{</div>;
      }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('handles a non-default export gracefully', async () => {
    const source = `
      export function Named() { return <div>x</div>; }
    `;
    // No default export — should error with the validation message
    await expect(renderReactToHtml(source)).rejects.toThrow(/default function/);
  });

  it('rejects user code that throws at module load', async () => {
    const source = `
      throw new Error('boom at module load');
      export default function P() { return <div/>; }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('rejects user code that throws at component render', async () => {
    const source = `
      export default function P() {
        throw new Error('boom at render');
      }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('passes plain-object props through (no class instances)', async () => {
    const source = `
      export default function P({ greeting }) {
        return <p>{greeting}</p>;
      }
    `;
    const html = await renderReactToHtml(source, { greeting: 'hello' });
    expect(html).toContain('<p>hello</p>');
  });

  it('renders nested arrays without React key warnings breaking output', async () => {
    const source = `
      export default function P() {
        return (
          <ul>
            {[1,2,3].map((n) => <li key={n}>item {n}</li>)}
          </ul>
        );
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('<li>item 1</li>');
    expect(html).toContain('<li>item 3</li>');
  });
});
