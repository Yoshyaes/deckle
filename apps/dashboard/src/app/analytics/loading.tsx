export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="h-7 w-28 animate-pulse rounded bg-white/5 mb-6" />

        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-[14px] p-4">
                <div className="h-3 w-28 animate-pulse rounded bg-white/5 mb-2" />
                <div className="h-6 w-16 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>

          {/* Chart skeleton */}
          <div className="bg-surface border border-border rounded-[14px] p-6">
            <div className="h-4 w-36 animate-pulse rounded bg-white/5 mb-4" />
            <div className="h-32 animate-pulse rounded bg-white/5" />
          </div>

          {/* Second chart skeleton */}
          <div className="bg-surface border border-border rounded-[14px] p-6">
            <div className="h-4 w-48 animate-pulse rounded bg-white/5 mb-4" />
            <div className="h-32 animate-pulse rounded bg-white/5" />
          </div>

          {/* Third section skeleton */}
          <div className="bg-surface border border-border rounded-[14px] p-6">
            <div className="h-4 w-40 animate-pulse rounded bg-white/5 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <div className="h-3 w-28 animate-pulse rounded bg-white/5" />
                    <div className="h-3 w-10 animate-pulse rounded bg-white/5" />
                  </div>
                  <div className="h-2 w-full animate-pulse rounded-full bg-white/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
