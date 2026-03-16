export default function Loading() {
  return (
    <div className="flex min-h-screen">
      <div className="w-[240px] shrink-0" />
      <main className="flex-1 p-6 overflow-y-auto max-w-2xl">
        <div className="h-7 w-24 animate-pulse rounded bg-white/5 mb-6" />

        {/* Account section */}
        <div className="bg-surface border border-border rounded-[14px] p-6 mb-6">
          <div className="h-4 w-20 animate-pulse rounded bg-white/5 mb-4" />
          <div className="space-y-4">
            <div>
              <div className="h-3 w-12 animate-pulse rounded bg-white/5 mb-1" />
              <div className="h-4 w-48 animate-pulse rounded bg-white/5" />
            </div>
            <div>
              <div className="h-3 w-16 animate-pulse rounded bg-white/5 mb-1" />
              <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        </div>

        {/* Plan section */}
        <div className="bg-surface border border-border rounded-[14px] p-6 mb-6">
          <div className="h-4 w-28 animate-pulse rounded bg-white/5 mb-4" />
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-56 animate-pulse rounded bg-white/5" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded-lg bg-white/5" />
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-surface border border-red/20 rounded-[14px] p-6">
          <div className="h-4 w-24 animate-pulse rounded bg-white/5 mb-4" />
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-64 animate-pulse rounded bg-white/5" />
            </div>
            <div className="h-9 w-32 animate-pulse rounded-lg bg-white/5" />
          </div>
        </div>
      </main>
    </div>
  );
}
