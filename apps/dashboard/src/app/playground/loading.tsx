export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
          <div className="h-5 w-24 animate-pulse rounded bg-white/5" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-16 animate-pulse rounded-lg bg-white/5" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-white/5" />
            <div className="h-8 w-28 animate-pulse rounded-lg bg-white/5" />
          </div>
        </div>

        {/* Split panes skeleton */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 flex flex-col border-r border-border">
            <div className="px-4 py-2 border-b border-border bg-surface">
              <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
            </div>
            <div className="flex-1 bg-[#0A0A0B] p-4">
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3 animate-pulse rounded bg-white/5"
                    style={{ width: `${40 + Math.random() * 50}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="w-1/2 flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-surface">
              <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
            </div>
            <div className="flex-1 bg-[#525659] flex items-center justify-center">
              <div className="text-gray-500 text-sm animate-pulse">Loading preview...</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
