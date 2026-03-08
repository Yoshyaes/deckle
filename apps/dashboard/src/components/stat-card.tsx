interface StatCardProps {
  value: string;
  label: string;
  trend?: string;
}

export function StatCard({ value, label, trend }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-[14px] p-5 flex-1 min-w-[140px]">
      <div className="text-xs text-text-dim font-medium mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold text-text-primary tracking-tight">
          {value}
        </span>
        {trend && (
          <span className="text-xs text-green font-semibold">{trend}</span>
        )}
      </div>
    </div>
  );
}
