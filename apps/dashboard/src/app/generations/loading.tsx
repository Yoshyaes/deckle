export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-36 animate-pulse rounded bg-white/5" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
          {/* Table header */}
          <div className="px-5 py-3 border-b border-border-subtle">
            <div className="h-4 w-full animate-pulse rounded bg-white/5" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`px-5 py-3 flex items-center gap-4 ${
                i < 7 ? 'border-b border-border-subtle' : ''
              }`}
            >
              <div className="w-2 h-2 rounded-full animate-pulse bg-white/5" />
              <div className="h-4 flex-1 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-16 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-16 animate-pulse rounded bg-white/5" />
              <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
