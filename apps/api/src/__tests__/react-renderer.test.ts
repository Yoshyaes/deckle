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
});
