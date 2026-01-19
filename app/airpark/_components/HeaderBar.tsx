"use client";

import { Pause, Play, RotateCcw, Radar, Download, PlayCircle } from "lucide-react";

type HeaderBarProps = {
  title?: string;
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onResetStart?: () => void;   // optional: reset then start fresh
  onExport?: () => void;       // optional: export CSVs
};

export default function HeaderBar({
  title = "FlyIRL SkyPark — Live UAV Collision Avoidance Lab",
  running,
  onToggleRun,
  onReset,
  onResetStart,
  onExport,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black/30 backdrop-blur p-3">
      <div className="mx-auto max-w-7xl flex items-center gap-3">
        <Radar className="w-6 h-6 text-indigo-300" />
        <h1 className="text-lg font-semibold tracking-wide">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Reset & Start (fresh experiment) */}
          {onResetStart && (
            <button
              onClick={onResetStart}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 flex items-center gap-2 text-sm"
              title="Reset counters/logs and start running"
            >
              <PlayCircle className="w-4 h-4" /> Reset & Start
            </button>
          )}
          {/* Run / Pause */}
          <button
            onClick={onToggleRun}
            className="px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 flex items-center gap-2 text-sm"
            title={running ? "Pause" : "Run"}
          >
            {running ? (<><Pause className="w-4 h-4" /> Pause</>) : (<><Play className="w-4 h-4" /> Run</>)}
          </button>
          {/* Reset (re-randomize) */}
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center gap-2 text-sm"
            title="Re-randomize plane seeds"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          {/* Export CSV */}
          {onExport && (
            <button
              onClick={onExport}
              className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center gap-2 text-sm"
              title="Download sim_log.csv, pair_distances.csv, trigger_log.csv"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
