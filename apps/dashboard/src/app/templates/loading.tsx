export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-32 animate-pulse rounded bg-white/5" />
          <div className="h-9 w-36 animate-pulse rounded-lg bg-white/5" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-[14px] p-5 space-y-3"
            >
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
