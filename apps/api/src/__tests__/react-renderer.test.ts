import { describe, it, expect } from 'vitest';
import { renderReactToHtml } from '../services/react-renderer.js';
import { ValidationError } from '../lib/errors.js';

describe('React renderer', () => {
  it('renders a valid component to HTML', () => {
    const source = `
      export default function Hello() {
        return <div><h1>Hello World</h1></div>;
      }
    `;
    const html = renderReactToHtml(source);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1>Hello World</h1>');
  });

  it('passes props to the component', () => {
    const source = `
      export default function Greet({ name }) {
        return <p>Hello, {name}!</p>;
      }
    `;
    const html = renderReactToHtml(source, { name: 'Alice' });
    expect(html).toContain('Hello, Alice!');
  });

  it('renders nested components', () => {
    const source = `
      function Item({ text }) {
        return <li>{text}</li>;
      }
      export default function List() {
        return <ul><Item text="A" /><Item text="B" /></ul>;
      }
    `;
    const html = renderReactToHtml(source);
    expect(html).toContain('<li>A</li>');
    expect(html).toContain('<li>B</li>');
  });

  it('includes custom styles when provided', () => {
    const source = `
      export default function Doc() {
        return <div>Content</div>;
      }
    `;
    const html = renderReactToHtml(source, {}, '.custom { color: red; }');
    expect(html).toContain('.custom { color: red; }');
  });

  it('throws ValidationError when source exceeds 1MB', () => {
    const source = 'x'.repeat(1_048_577);
    expect(() => renderReactToHtml(source)).toThrow(ValidationError);
    expect(() => renderReactToHtml(source)).toThrow('exceeds maximum size');
  });

  it('throws ValidationError when export is not a function', () => {
    const source = `
      module.exports.default = "not a function";
    `;
    expect(() => renderReactToHtml(source)).toThrow(ValidationError);
  });

  it('throws ValidationError for component that does not export default', () => {
    const source = `
      const x = 42;
      module.exports = x;
    `;
    expect(() => renderReactToHtml(source)).toThrow(ValidationError);
  });

  it('process is undefined in sandbox', () => {
    const source = `
      export default function Test() {
        const val = typeof process;
        return <div>{val}</div>;
      }
    `;
    const html = renderReactToHtml(source);
    expect(html).toContain('undefined');
  });

  it('require("fs") throws an error in sandbox', () => {
    const source = `
      const fs = require('fs');
      export default function Test() {
        return <div>test</div>;
      }
    `;
    expect(() => renderReactToHtml(source)).toThrow();
  });

  it('require("react") works in sandbox', () => {
    const source = `
      const React = require('react');
      export default function Test() {
        return React.createElement('span', null, 'works');
      }
    `;
    const html = renderReactToHtml(source);
    expect(html).toContain('<span>works</span>');
  });

  it('renders component with array map', () => {
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
    const html = renderReactToHtml(source, { items: ['one', 'two', 'three'] });
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
    expect(html).toContain('<li>three</li>');
  });

  it('wraps output in a full HTML document', () => {
    const source = `
      export default function Doc() {
        return <p>content</p>;
      }
    `;
    const html = renderReactToHtml(source);
    expect(html).toContain('<html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });
});
