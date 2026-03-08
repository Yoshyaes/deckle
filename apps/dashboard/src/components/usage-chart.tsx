'use client';

import { useState } from 'react';

interface UsageChartProps {
  data?: number[];
}

export function UsageChart({ data }: UsageChartProps) {
  const [activePeriod, setActivePeriod] = useState('30d');
  const chartData = data || Array(30).fill(0);
  const maxVal = Math.max(...chartData, 1);

  return (
    <div className="bg-surface border border-border rounded-[14px] p-6">
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-semibold text-text-primary">
          Generation Volume
        </span>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              disabled={period !== '30d'}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                period === activePeriod
                  ? 'border-accent/30 bg-accent-soft text-accent'
                  : 'border-border bg-transparent text-text-dim opacity-50 cursor-not-allowed'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-1 h-[120px] px-2">
        {chartData.map((val, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${(val / maxVal) * 100}%`,
              minHeight: val > 0 ? 4 : 0,
              background:
                i >= chartData.length - 3
                  ? 'linear-gradient(180deg, #F97316, #F97316aa)'
                  : 'linear-gradient(180deg, #F9731644, #F9731622)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
