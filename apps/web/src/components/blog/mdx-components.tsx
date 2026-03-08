import { CodeBlock } from '@/components/ui/code-block';

type MDXComponentMap = Record<string, React.ComponentType<any>>;

export const mdxComponents: MDXComponentMap = {
  h1: (props) => (
    <h1 className="text-3xl font-bold text-text-primary tracking-tight mt-8 mb-4" {...props} />
  ),
  h2: (props) => (
    <h2 className="text-2xl font-bold text-text-primary tracking-tight mt-8 mb-3" {...props} />
  ),
  h3: (props) => (
    <h3 className="text-xl font-semibold text-text-primary mt-6 mb-2" {...props} />
  ),
  p: (props) => (
    <p className="text-text-muted leading-relaxed mb-4" {...props} />
  ),
  ul: (props) => (
    <ul className="list-disc list-inside text-text-muted mb-4 space-y-1" {...props} />
  ),
  ol: (props) => (
    <ol className="list-decimal list-inside text-text-muted mb-4 space-y-1" {...props} />
  ),
  li: (props) => <li className="leading-relaxed" {...props} />,
  a: (props) => (
    <a className="text-accent hover:text-orange-400 underline underline-offset-2" {...props} />
  ),
  code: (props) => (
    <code className="font-mono text-sm bg-surface px-1.5 py-0.5 rounded text-accent" {...props} />
  ),
  pre: ({ children, ...props }) => {
    const codeEl = children as React.ReactElement<{ children?: string; className?: string }>;
    const code = typeof codeEl?.props?.children === 'string' ? codeEl.props.children : '';
    const lang = codeEl?.props?.className?.replace('language-', '') || 'text';
    return <div className="mb-4"><CodeBlock code={code.trim()} language={lang} /></div>;
  },
  blockquote: (props) => (
    <blockquote className="border-l-2 border-accent pl-4 my-4 text-text-dim italic" {...props} />
  ),
  hr: () => <hr className="border-border my-8" />,
  strong: (props) => <strong className="text-text-primary font-semibold" {...props} />,
};
