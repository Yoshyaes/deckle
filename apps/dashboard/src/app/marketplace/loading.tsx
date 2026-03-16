export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="h-7 w-52 animate-pulse rounded bg-white/5 mb-2" />
            <div className="h-4 w-72 animate-pulse rounded bg-white/5" />
          </div>

          {/* Search bar skeleton */}
          <div className="h-10 w-full animate-pulse rounded-lg bg-white/5 mb-6" />

          {/* Template grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border-subtle bg-surface p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
                  <div className="h-4 w-10 animate-pulse rounded bg-white/5" />
                </div>
                <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
                <div className="h-8 w-full animate-pulse rounded-lg bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
