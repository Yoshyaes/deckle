'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Key, FileText, Terminal, Package, X } from 'lucide-react';

interface OnboardingChecklistProps {
  hasApiKey: boolean;
  hasGeneration: boolean;
  apiKeyPreview?: string;
}

const DISMISS_KEY = 'deckle:onboarding-dismissed';
const SDK_TAB_KEY = 'deckle:sdk-tab';

type StepId = 'first-pdf' | 'api-key' | 'try-api' | 'install-sdk';

const stepMeta: Record<
  StepId,
  { label: string; icon: typeof FileText }
> = {
  'first-pdf': { label: 'Generate your first PDF in the playground', icon: FileText },
  'api-key': { label: 'Create an API key', icon: Key },
  'try-api': { label: 'Call the API from code', icon: Terminal },
  'install-sdk': { label: 'Install an official SDK', icon: Package },
};

const STEP_ORDER: StepId[] = ['first-pdf', 'api-key', 'try-api', 'install-sdk'];

const SDK_TABS = [
  {
    id: 'ts',
    label: 'TypeScript',
    install: 'npm install @getdeckle/sdk',
    code: `import { Deckle } from '@getdeckle/sdk';

// The constructor takes the API key as the first positional argument.
const df = new Deckle(process.env.DECKLE_API_KEY!);

const pdf = await df.generate({
  html: '<h1>Hello from Deckle!</h1>',
});
console.log(pdf.url);`,
  },
  {
    id: 'python',
    label: 'Python',
    install: 'pip install deckle',
    code: `import os
from deckle import Deckle

# The constructor takes the API key as the first positional argument.
df = Deckle(os.environ["DECKLE_API_KEY"])

pdf = df.generate(html="<h1>Hello from Deckle!</h1>")
print(pdf.url)`,
  },
  {
    id: 'go',
    label: 'Go',
    install: 'go get github.com/Yoshyaes/deckle/packages/sdk-go',
    code: `import "github.com/Yoshyaes/deckle/packages/sdk-go"

client := deckle.NewClient(os.Getenv("DECKLE_API_KEY"))
pdf, err := client.Generate(ctx, deckle.GenerateParams{
    HTML: "<h1>Hello from Deckle!</h1>",
})`,
  },
  {
    id: 'ruby',
    label: 'Ruby',
    install: 'gem install deckle',
    code: `require "deckle"

df = Deckle::Client.new(api_key: ENV["DECKLE_API_KEY"])
pdf = df.generate(html: "<h1>Hello from Deckle!</h1>")
puts pdf.url`,
  },
] as const;

export function OnboardingChecklist({
  hasApiKey,
  hasGeneration,
  apiKeyPreview,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sdkTab, setSdkTab] = useState<(typeof SDK_TABS)[number]['id']>('ts');
  const [sdkExpanded, setSdkExpanded] = useState(false);
  const [installSdkDone, setInstallSdkDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
    }
    if (window.localStorage.getItem('deckle:onboarding-sdk-done') === '1') {
      setInstallSdkDone(true);
    }
    const savedTab = window.localStorage.getItem(SDK_TAB_KEY) as
      | (typeof SDK_TABS)[number]['id']
      | null;
    if (savedTab && SDK_TABS.some((t) => t.id === savedTab)) {
      setSdkTab(savedTab);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
  };

  if (dismissed) return null;

  // "install-sdk" has no DB signal — treat it as opt-in (marked done when user
  // clicks "mark as done" after inspecting the snippets).
  const completedSteps: Record<StepId, boolean> = {
    'first-pdf': hasGeneration,
    'api-key': hasApiKey,
    'try-api': hasGeneration && hasApiKey,
    'install-sdk': installSdkDone,
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const allDone = completedCount === STEP_ORDER.length;
  if (allDone) return null;

  const keyPlaceholder = apiKeyPreview ? `${apiKeyPreview}...` : 'YOUR_API_KEY';
  const curlCommand = `curl -X POST https://api.getdeckle.dev/v1/generate \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"html": "<h1>Hello from Deckle!</h1>"}'`;

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const markSdkDone = () => {
    setInstallSdkDone(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('deckle:onboarding-sdk-done', '1');
    }
  };

  const chooseSdkTab = (id: (typeof SDK_TABS)[number]['id']) => {
    setSdkTab(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SDK_TAB_KEY, id);
    }
  };

  const activeSdk = SDK_TABS.find((t) => t.id === sdkTab) ?? SDK_TABS[0];

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-bold text-text-primary">
            Get started with Deckle
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Generate your first PDF in under 5 minutes
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-text-dim hover:text-text-muted transition-colors p-1"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-yellow-400 transition-all duration-500"
            style={{ width: `${(completedCount / STEP_ORDER.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-dim font-medium">
          {completedCount}/{STEP_ORDER.length}
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEP_ORDER.map((id) => {
          const meta = stepMeta[id];
          const done = completedSteps[id];
          const Icon = meta.icon;
          const isFirstOpen = !done && id === STEP_ORDER.find((s) => !completedSteps[s]);

          return (
            <div
              key={id}
              className={`rounded-lg px-3 py-2.5 transition-colors ${
                done ? 'bg-green-500/5' : isFirstOpen ? 'bg-accent/5' : 'bg-surface-hover/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      done
                        ? 'bg-green-500/20 text-green-400'
                        : 'border border-border-subtle text-text-dim'
                    }`}
                  >
                    {done ? (
                      <Check size={12} strokeWidth={3} />
                    ) : (
                      <Icon size={11} />
                    )}
                  </div>
                  <span
                    className={`text-[13px] font-medium ${
                      done ? 'text-text-muted line-through' : 'text-text-primary'
                    }`}
                  >
                    {meta.label}
                  </span>
                </div>

                {!done && id === 'first-pdf' && (
                  <Link
                    href="/playground?template=invoice&autorun=1"
                    className="text-xs font-semibold text-accent hover:text-orange-400 transition-colors"
                  >
                    Open playground
                  </Link>
                )}
                {!done && id === 'api-key' && (
                  <Link
                    href="/keys"
                    className="text-xs font-semibold text-accent hover:text-orange-400 transition-colors"
                  >
                    Create key
                  </Link>
                )}
                {!done && id === 'try-api' && (
                  <button
                    onClick={() => copy('curl', curlCommand)}
                    className="text-xs font-semibold text-accent hover:text-orange-400 transition-colors"
                  >
                    {copied === 'curl' ? 'Copied!' : 'Copy curl'}
                  </button>
                )}
                {!done && id === 'install-sdk' && (
                  <button
                    onClick={() => setSdkExpanded((v) => !v)}
                    className="text-xs font-semibold text-accent hover:text-orange-400 transition-colors"
                  >
                    {sdkExpanded ? 'Hide' : 'Show snippets'}
                  </button>
                )}
              </div>

              {/* Inline SDK tabs panel */}
              {id === 'install-sdk' && sdkExpanded && !done && (
                <div className="mt-3 pt-3 border-t border-border-subtle">
                  <div className="flex gap-2 mb-2">
                    {SDK_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => chooseSdkTab(tab.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                          sdkTab === tab.id
                            ? 'bg-accent/20 text-accent'
                            : 'text-text-dim hover:text-text-muted'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded bg-[#0A0A0B] border border-border-subtle p-3 mb-2 flex items-center justify-between">
                    <code className="text-[11px] text-text-primary font-mono">
                      {activeSdk.install}
                    </code>
                    <button
                      onClick={() => copy(`install-${activeSdk.id}`, activeSdk.install)}
                      className="text-[10px] text-accent font-semibold ml-3"
                    >
                      {copied === `install-${activeSdk.id}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="rounded bg-[#0A0A0B] border border-border-subtle p-3 relative">
                    <pre className="text-[11px] text-text-primary font-mono whitespace-pre-wrap">
                      {activeSdk.code}
                    </pre>
                    <button
                      onClick={() => {
                        copy(`code-${activeSdk.id}`, activeSdk.code);
                        markSdkDone();
                      }}
                      className="absolute top-2 right-2 text-[10px] text-accent font-semibold"
                    >
                      {copied === `code-${activeSdk.id}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => {
                        markSdkDone();
                        setSdkExpanded(false);
                      }}
                      className="text-[11px] text-text-dim hover:text-text-muted"
                    >
                      Mark as done
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
