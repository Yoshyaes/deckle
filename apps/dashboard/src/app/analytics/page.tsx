'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';

interface AnalyticsData {
  top_templates: { template_id: string; template_name: string; count: number }[];
  error_rate: number;
  total_generations: number;
  failed_generations: number;
  avg_latency_by_day: { date: string; avg_ms: number }[];
  generation_by_type: { type: string; count: number }[];
  daily_generations: { date: string; count: number }[];
  peak_hours: { hour: number; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-6">
          Analytics
        </h1>

        {loading && (
          <div className="text-text-dim text-sm">Loading analytics...</div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Generations" value={data.total_generations.toLocaleString()} />
              <StatCard label="Failed" value={data.failed_generations.toLocaleString()} />
              <StatCard label="Error Rate" value={`${data.error_rate}%`} />
              <StatCard
                label="Avg Latency"
                value={
                  data.avg_latency_by_day.length > 0
                    ? `${data.avg_latency_by_day[data.avg_latency_by_day.length - 1].avg_ms}ms`
                    : 'N/A'
                }
              />
            </div>

            {/* Generation by type */}
            <section className="bg-surface border border-border rounded-[14px] p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Generation by Type
              </h2>
              <div className="flex gap-6">
                {data.generation_by_type.map((t) => (
                  <div key={t.type} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        background:
                          t.type === 'html' ? '#f97316' :
                          t.type === 'template' ? '#3b82f6' : '#8b5cf6',
                      }}
                    />
                    <span className="text-sm text-text-muted capitalize">{t.type}</span>
                    <span className="text-sm font-medium text-text-primary">{t.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Daily generations chart (text-based) */}
            <section className="bg-surface border border-border rounded-[14px] p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Daily Generations (Last 30 Days)
              </h2>
              {data.daily_generations.length === 0 ? (
                <p className="text-sm text-text-dim">No data available</p>
              ) : (
                <div className="flex items-end gap-[2px] h-32">
                  {data.daily_generations.map((d, i) => {
                    const max = Math.max(...data.daily_generations.map((x) => x.count), 1);
                    const pct = (d.count / max) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-gradient-to-t from-accent to-yellow-400 rounded-t-sm min-h-[2px]"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        title={`${d.date}: ${d.count}`}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {/* Top templates */}
            <section className="bg-surface border border-border rounded-[14px] p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Most Used Templates
              </h2>
              {data.top_templates.length === 0 ? (
                <p className="text-sm text-text-dim">No template usage yet</p>
              ) : (
                <div className="space-y-3">
                  {data.top_templates.map((t, i) => {
                    const max = data.top_templates[0]?.count || 1;
                    const pct = (t.count / max) * 100;
                    return (
                      <div key={t.template_id || i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-muted">{t.template_name}</span>
                          <span className="text-text-primary font-medium">{t.count}</span>
                        </div>
                        <div className="h-2 bg-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent to-yellow-400 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Peak hours */}
            <section className="bg-surface border border-border rounded-[14px] p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Peak Usage Hours
              </h2>
              {data.peak_hours.length === 0 ? (
                <p className="text-sm text-text-dim">No data available</p>
              ) : (
                <div className="flex items-end gap-1 h-24">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const entry = data.peak_hours.find((h) => h.hour === hour);
                    const count = entry?.count || 0;
                    const max = Math.max(...data.peak_hours.map((h) => h.count), 1);
                    const pct = (count / max) * 100;
                    return (
                      <div
                        key={hour}
                        className="flex-1 bg-accent/60 rounded-t-sm min-h-[2px]"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        title={`${hour}:00 — ${count} generations`}
                      />
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between mt-2 text-[10px] text-text-dim">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
                <span>12am</span>
              </div>
            </section>

            {/* Avg latency trend */}
            <section className="bg-surface border border-border rounded-[14px] p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4">
                Average Latency Trend (ms)
              </h2>
              {data.avg_latency_by_day.length === 0 ? (
                <p className="text-sm text-text-dim">No data available</p>
              ) : (
                <div className="flex items-end gap-[2px] h-24">
                  {data.avg_latency_by_day.map((d, i) => {
                    const max = Math.max(...data.avg_latency_by_day.map((x) => x.avg_ms), 1);
                    const pct = (d.avg_ms / max) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-blue-500/60 rounded-t-sm min-h-[2px]"
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        title={`${d.date}: ${d.avg_ms}ms`}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-[14px] p-4">
      <div className="text-xs text-text-dim mb-1">{label}</div>
      <div className="text-xl font-bold text-text-primary">{value}</div>
    </div>
  );
}
