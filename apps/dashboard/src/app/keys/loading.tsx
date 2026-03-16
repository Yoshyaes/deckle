export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="h-7 w-28 animate-pulse rounded bg-white/5 mb-6" />

        {/* Keys list skeleton */}
        <div className="bg-surface border border-border rounded-[14px] overflow-hidden mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`px-5 py-4 flex items-center justify-between ${
                i < 2 ? 'border-b border-border-subtle' : ''
              }`}
            >
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
                <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-8 w-20 animate-pulse rounded-lg bg-white/5" />
            </div>
          ))}
        </div>

        {/* Security info skeleton */}
        <div className="bg-surface border border-border rounded-[14px] p-5">
          <div className="h-4 w-32 animate-pulse rounded bg-white/5 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 w-64 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
