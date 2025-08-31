"use client";

import { Zap } from "lucide-react";

type LogRow = {
  t: number;
  aid: string;
  triggerId: string;
  source: string;
  note: string;
};

type LogsPanelProps = {
  logs: LogRow[];
  title?: string;
  className?: string;
  /** Tailwind height classes (container with scroll) */
  heightClassName?: string;
  /** Limit displayed rows (perf) */
  limit?: number;
};

export default function LogsPanel({
  logs,
  title = "Control Callouts",
  className,
  heightClassName = "h-full max-h-[38vh] md:max-h-none md:h-[calc(100vh-420px)]",
  limit = 150,
}: LogsPanelProps) {
  const shown = logs.slice(0, limit);

  return (
    <div
      className={
        className ??
        "rounded-2xl bg-[#0f1420] p-3 shadow ring-1 ring-white/10 min-h-0"
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-4 h-4 text-amber-300" />
        <span className="font-medium">{title}</span>
      </div>

      <div className={`${heightClassName} overflow-auto space-y-1 pr-1`}>
        {shown.map((r, idx) => (
          <div
            key={`${r.t}-${r.aid}-${idx}`}
            className="text-xs text-white/80 grid grid-cols-[72px_52px_1fr] gap-2"
          >
            <span className="text-white/60">{r.t.toFixed(2)}s</span>
            <span className="font-semibold">{r.aid}</span>
            <span className="truncate">[{r.source}] {r.note}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-xs text-white/50">(No events yet)</div>
        )}
      </div>
    </div>
  );
}
