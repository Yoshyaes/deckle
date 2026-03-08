import Link from 'next/link';

interface Generation {
  id: string;
  template?: string;
  pages: number;
  time: string;
  status: 'completed' | 'failed';
  ago: string;
}

interface GenerationTableProps {
  generations: Generation[];
  title?: string;
}

export function GenerationTable({
  generations,
  title = 'Recent Generations',
}: GenerationTableProps) {
  return (
    <div className="bg-surface border border-border rounded-[14px] overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <span className="text-sm font-semibold text-text-primary">{title}</span>
      </div>
      {generations.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-text-dim">
          No generations yet. Generate your first PDF via the API.
        </div>
      ) : (
        generations.map((gen, i) => (
          <Link
            key={gen.id}
            href={`/generations/${gen.id}`}
            className={`flex items-center px-5 py-3 gap-4 hover:bg-surface-hover/50 transition-colors cursor-pointer ${
              i < generations.length - 1 ? 'border-b border-border-subtle' : ''
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                gen.status === 'completed' ? 'bg-green' : 'bg-red'
              }`}
            />
            <div className="flex-1">
              <span className="font-mono text-xs text-text-primary font-medium">
                {gen.id}
              </span>
            </div>
            <div className="text-xs text-text-dim w-20">
              {gen.template || 'HTML'}
            </div>
            <div className="text-xs text-text-dim w-16">
              {gen.pages} {gen.pages === 1 ? 'page' : 'pages'}
            </div>
            <div className="text-xs text-text-dim w-12">{gen.time}</div>
            <div className="text-xs text-text-dim w-16 text-right">
              {gen.ago}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
