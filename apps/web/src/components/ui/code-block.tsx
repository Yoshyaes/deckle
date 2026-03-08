interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  return (
    <div className="relative rounded-xl bg-[#0D0D0F] border border-border overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border">
        <div className="w-2.5 h-2.5 rounded-full bg-red/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
        <div className="w-2.5 h-2.5 rounded-full bg-green/50" />
        <span className="ml-2 text-xs text-text-dim">{language}</span>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <code className="font-mono text-text-primary">{code}</code>
      </pre>
    </div>
  );
}
