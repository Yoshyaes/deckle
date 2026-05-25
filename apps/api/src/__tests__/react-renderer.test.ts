import { describe, it, expect } from 'vitest';
import { renderReactToHtml } from '../services/react-renderer.js';
import { ValidationError } from '../lib/errors.js';

describe('React renderer', () => {
  it('renders a valid component to HTML', async () => {
    const source = `
      export default function Hello() {
        return <div><h1>Hello World</h1></div>;
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1>Hello World</h1>');
  });

  it('passes props to the component', async () => {
    const source = `
      export default function Greet({ name }) {
        return <p>Hello, {name}!</p>;
      }
    `;
    const html = await renderReactToHtml(source, { name: 'Alice' });
    expect(html).toContain('Hello, Alice!');
  });

  it('renders nested components', async () => {
    const source = `
      function Item({ text }) {
        return <li>{text}</li>;
      }
      export default function List() {
        return <ul><Item text="A" /><Item text="B" /></ul>;
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('<li>A</li>');
    expect(html).toContain('<li>B</li>');
  });

  it('includes custom styles when provided', async () => {
    const source = `
      export default function Doc() {
        return <div>Content</div>;
      }
    `;
    const html = await renderReactToHtml(source, {}, '.custom { color: red; }');
    expect(html).toContain('.custom { color: red; }');
  });

  it('strips </style> close tags from styles to prevent injection', async () => {
    const source = `
      export default function Doc() {
        return <div>Content</div>;
      }
    `;
    const maliciousStyles = 'body { color: red; }</style><script>alert(1)</script><style>';
    const html = await renderReactToHtml(source, {}, maliciousStyles);
    expect(html).not.toContain('</style><script>');
    expect(html).toContain('body { color: red; }');
  });

  it('throws ValidationError when source exceeds 1MB', async () => {
    const source = 'x'.repeat(1_048_577);
    await expect(renderReactToHtml(source)).rejects.toThrow(ValidationError);
    await expect(renderReactToHtml(source)).rejects.toThrow('exceeds maximum size');
  });

  it('throws ValidationError when export is not a function', async () => {
    const source = `
      module.exports.default = "not a function";
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for component that does not export default', async () => {
    const source = `
      const x = 42;
      module.exports = x;
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow(ValidationError);
  });

  it('process is undefined in sandbox', async () => {
    const source = `
      export default function Test() {
        const val = typeof process;
        return <div>{val}</div>;
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('undefined');
  });

  it('require("fs") throws an error in sandbox', async () => {
    const source = `
      const fs = require('fs');
      export default function Test() {
        return <div>test</div>;
      }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('require("react") works in sandbox', async () => {
    const source = `
      const React = require('react');
      export default function Test() {
        return React.createElement('span', null, 'works');
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('<span>works</span>');
  });

  it('renders component with array map', async () => {
    const source = `
      export default function Items({ items }) {
        return (
          <ul>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      }
    `;
    const html = await renderReactToHtml(source, { items: ['one', 'two', 'three'] });
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
    expect(html).toContain('<li>three</li>');
  });

  it('wraps output in a full HTML document', async () => {
    const source = `
      export default function Doc() {
        return <p>content</p>;
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('<html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });

  it('child process cannot read secrets from the parent env', async () => {
    // Set a fake secret in the parent's environment.
    process.env.SHOULD_NOT_LEAK = 'super-secret-value';
    try {
      // Defensively probe for process.env; do NOT throw if process is undefined.
      // If the secret leaks we'd see it in the rendered HTML.
      const source = `
        const val = (typeof process !== 'undefined' && process && process.env && process.env.SHOULD_NOT_LEAK)
          ? process.env.SHOULD_NOT_LEAK
          : 'NOT_SET';
        export default function Test() { return <span>{val}</span>; }
      `;
      const html = await renderReactToHtml(source);
      expect(html).toContain('<span>NOT_SET</span>');
      expect(html).not.toContain('super-secret-value');
    } finally {
      delete process.env.SHOULD_NOT_LEAK;
    }
  });

  it('worker rejects child_process require', async () => {
    const source = `
      const cp = require('child_process');
      export default function Test() { return <div>x</div>; }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('worker rejects require("net") / network primitives', async () => {
    const source = `
      const net = require('net');
      export default function Test() { return <div>x</div>; }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('Function constructor is unavailable in sandbox', async () => {
    const source = `
      export default function Test() {
        const fn = new Function('return 1');
        return <div>{fn()}</div>;
      }
    `;
    // Function is set to undefined in the inner context
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('eval is unavailable in sandbox', async () => {
    const source = `
      export default function Test() {
        eval('1+1');
        return <div>x</div>;
      }
    `;
    await expect(renderReactToHtml(source)).rejects.toThrow();
  });

  it('renders concurrent requests in independent child processes', async () => {
    // Two concurrent renders must not interfere with each other.
    const src = (label: string) => `
      export default function L() { return <span>${label}</span>; }
    `;
    const [a, b] = await Promise.all([
      renderReactToHtml(src('alpha')),
      renderReactToHtml(src('bravo')),
    ]);
    expect(a).toContain('<span>alpha</span>');
    expect(b).toContain('<span>bravo</span>');
  });

  it('renders React.Fragment correctly', async () => {
    const source = `
      export default function Frag() {
        return <><span>a</span><span>b</span></>;
      }
    `;
    const html = await renderReactToHtml(source);
    expect(html).toContain('<span>a</span>');
    expect(html).toContain('<span>b</span>');
  });

  it('renders TypeScript-only syntax (type annotations)', async () => {
    const source = `
      interface Props { name: string }
      export default function Hi(props: Props) {
        const s: string = "ts ok: " + props.name;
        return <p>{s}</p>;
      }
    `;
    const html = await renderReactToHtml(source, { name: 'x' });
    expect(html).toContain('ts ok: x');
  });
});
