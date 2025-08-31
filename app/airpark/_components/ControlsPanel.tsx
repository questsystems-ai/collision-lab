"use client";

import { Settings2, RefreshCw } from "lucide-react";
import ParamGroup from "././ParamGroup";
import Toggle from "././Toggle";
import Slider from "././Slider";
import TwoSlider from "././TwoSlider";
import FastScorePanel from "././FastScorePanel";

type Params = {
  MID_TTC_THRESHOLD: number;
  MID_SEP_TRIGGER: number;
  WALL_TTC_THRESHOLD: number;
  WALL_PADDING: number;
  K_GAIN: number;
  G_MIN: number;
  G_MAX: number;
  HORIZON_S: number;
  H_DT: number;
  OPEN_SAFE_SEP: number;
  OPEN_HOLD_S: number;
  OOB_RETURN_AFTER: number;
  OOB_RETURN_G: number;
  OOB_RELEASE_MARGIN: number;
  enableMidair: boolean;
  enableWall: boolean;
  enableGuardrail: boolean;
  enableOOBReturn: boolean;
};

type FastScore = {
  lambda_per_hour: number;
  ten_year_risk: number;
  collisions: number;
  near_misses: number;
  avg_sep: number;
  system_frac: number;
} | null;

type ControlsPanelProps = {
  params: Params;
  setParams: React.Dispatch<React.SetStateAction<Params>>;
  fastScore: FastScore;
  scoring: boolean;
  onFastScore: () => void;
  onRerandomize: () => void;
  onAddPlane: () => void;
  onRemovePlane: () => void;
  className?: string;
};

export default function ControlsPanel({
  params,
  setParams,
  fastScore,
  scoring,
  onFastScore,
  onRerandomize,
  onAddPlane,
  onRemovePlane,
  className,
}: ControlsPanelProps) {
  return (
    <div
      className={
        className ??
        "rounded-2xl bg-[#0f1420] p-3 shadow ring-1 ring-white/10 min-h-0 overflow-auto"
      }
    >
      <div className="flex items-center gap-2 mb-2">
        <Settings2 className="w-4 h-4 text-cyan-300" />
        <span className="font-medium">Parameters</span>
      </div>

      <ParamGroup title="Midair (A, B, D, E)">
        <Toggle
          label="Enable Midair"
          value={params.enableMidair}
          onChange={(v) => setParams((p) => ({ ...p, enableMidair: v }))}
        />
        <Slider
          label="MID_TTC_THRESHOLD"
          min={0.5}
          max={8}
          step={0.1}
          value={params.MID_TTC_THRESHOLD}
          onChange={(v) => setParams((p) => ({ ...p, MID_TTC_THRESHOLD: v }))}
        />
        <Slider
          label="MID_SEP_TRIGGER"
          min={20}
          max={200}
          step={5}
          value={params.MID_SEP_TRIGGER}
          onChange={(v) => setParams((p) => ({ ...p, MID_SEP_TRIGGER: v }))}
        />
        <Slider
          label="K_GAIN (g scaling)"
          min={0.05}
          max={0.6}
          step={0.01}
          value={params.K_GAIN}
          onChange={(v) => setParams((p) => ({ ...p, K_GAIN: v }))}
        />
        <TwoSlider
          labelA="G_MIN"
          labelB="G_MAX"
          min={1.5}
          max={6}
          step={0.1}
          valueA={params.G_MIN}
          valueB={params.G_MAX}
          onChangeA={(v) => setParams((p) => ({ ...p, G_MIN: v }))}
          onChangeB={(v) => setParams((p) => ({ ...p, G_MAX: v }))}
        />
        <Slider
          label="Shadow HORIZON_S"
          min={1}
          max={6}
          step={0.1}
          value={params.HORIZON_S}
          onChange={(v) => setParams((p) => ({ ...p, HORIZON_S: v }))}
        />
      </ParamGroup>

      <ParamGroup title="Wall & OOB">
        <Toggle
          label="Enable Wall Avoidance"
          value={params.enableWall}
          onChange={(v) => setParams((p) => ({ ...p, enableWall: v }))}
        />
        <Slider
          label="WALL_TTC_THRESHOLD"
          min={1}
          max={6}
          step={0.1}
          value={params.WALL_TTC_THRESHOLD}
          onChange={(v) => setParams((p) => ({ ...p, WALL_TTC_THRESHOLD: v }))}
        />
        <Slider
          label="WALL_PADDING"
          min={0}
          max={80}
          step={2}
          value={params.WALL_PADDING}
          onChange={(v) => setParams((p) => ({ ...p, WALL_PADDING: v }))}
        />
        <Toggle
          label="Enable OOB Return"
          value={params.enableOOBReturn}
          onChange={(v) => setParams((p) => ({ ...p, enableOOBReturn: v }))}
        />
        <Slider
          label="OOB_RETURN_AFTER"
          min={0.2}
          max={5}
          step={0.1}
          value={params.OOB_RETURN_AFTER}
          onChange={(v) => setParams((p) => ({ ...p, OOB_RETURN_AFTER: v }))}
        />
        <Slider
          label="OOB_RETURN_G"
          min={1.5}
          max={6}
          step={0.1}
          value={params.OOB_RETURN_G}
          onChange={(v) => setParams((p) => ({ ...p, OOB_RETURN_G: v }))}
        />
        <Slider
          label="OOB_RELEASE_MARGIN"
          min={0}
          max={20}
          step={0.5}
          value={params.OOB_RELEASE_MARGIN}
          onChange={(v) =>
            setParams((p) => ({ ...p, OOB_RELEASE_MARGIN: v }))
          }
        />
      </ParamGroup>

      <ParamGroup title="Early Exit (E) & Retrigger (F)">
        <Toggle
          label="Enable Early-Exit + Retrigger"
          value={params.enableGuardrail}
          onChange={(v) => setParams((p) => ({ ...p, enableGuardrail: v }))}
        />
        <Slider
          label="OPEN_SAFE_SEP"
          min={40}
          max={200}
          step={5}
          value={params.OPEN_SAFE_SEP}
          onChange={(v) => setParams((p) => ({ ...p, OPEN_SAFE_SEP: v }))}
        />
        <Slider
          label="OPEN_HOLD_S"
          min={0.1}
          max={2}
          step={0.05}
          value={params.OPEN_HOLD_S}
          onChange={(v) => setParams((p) => ({ ...p, OPEN_HOLD_S: v }))}
        />
      </ParamGroup>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onFastScore}
            disabled={scoring}
            className={`px-3 py-1.5 rounded-xl text-sm ${
              scoring
                ? "bg-emerald-700/60 cursor-wait"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
            title="Monte-Carlo fast score of current parameters"
          >
            {scoring ? "Scoring…" : "Fast score (64×2min)"}
          </button>

          <button
            onClick={onRerandomize}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Re-randomize
          </button>
          <button
            onClick={onAddPlane}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm"
          >
            + Plane
          </button>
          <button
            onClick={onRemovePlane}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm"
          >
            − Plane
          </button>
        </div>

        <FastScorePanel fastScore={fastScore} />
      </div>
    </div>
  );
}
