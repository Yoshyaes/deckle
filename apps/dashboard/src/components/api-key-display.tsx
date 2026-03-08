'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface ApiKeyDisplayProps {
  keyPreview: string;
  fullKey?: string;
}

export function ApiKeyDisplay({ keyPreview, fullKey }: ApiKeyDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = fullKey || keyPreview;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-[14px] p-5">
      <div className="text-sm font-semibold text-text-primary mb-3">
        Your API Key
      </div>
      <div className="flex items-center gap-3 bg-[#0D0D0F] border border-border rounded-lg px-4 py-2.5 font-mono text-[13px]">
        <span className="text-text-muted flex-1">{keyPreview}</span>
        <button
          onClick={handleCopy}
          className="text-text-dim hover:text-text-primary transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
