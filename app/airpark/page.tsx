"use client";

import React from "react";
import { scoreParamsFast } from "../../lib/fastsim";

// Components
import HeaderBar from "./_components/HeaderBar";
import ArenaCanvas from "./_components/ArenaCanvas";
import PairwiseChart from "./_components/PairwiseChart";
import CenterDistanceChart from "./_components/CenterDistanceChart";
import LogsPanel from "./_components/LogsPanel";
import ControlsPanel from "./_components/ControlsPanel";
import FooterBar from "./_components/FooterBar";

// Hook
import { useAirparkSim } from "../../lib/sim/useAirparkSim";

/*********************************
 * Tunables & Defaults
 *********************************/
const WORLD_W = 900;
const WORLD_H = 600;
const TICK_HZ = 30;
const MAX_AIRCRAFT = 8;

const DEFAULTS = {
  MID_TTC_THRESHOLD: 3.0,
  MID_SEP_TRIGGER: 60.0,
  WALL_TTC_THRESHOLD: 2.5,
  WALL_PADDING: 10.0,
  K_GAIN: 0.2,
  G_MIN: 2.0,
  G_MAX: 4.5,
  HORIZON_S: 3.0,
  H_DT: 0.05,
  OPEN_SAFE_SEP: 90.0,
  OPEN_HOLD_S: 0.5,
  OOB_RETURN_AFTER: 1.5,
  OOB_RETURN_G: 3.0,
  OOB_RELEASE_MARGIN: 5.0,
  enableMidair: true,
  enableWall: true,
  enableGuardrail: true,
  enableOOBReturn: true,
};

export default function AirparkPage() {
  // Bridge to the fast scorer (same mapping as before)
  const runFastScore = async (p: any, n: number) =>
    scoreParamsFast(
      {
        WORLD_W,
        WORLD_H,
        MID_TTC_THRESHOLD: p.MID_TTC_THRESHOLD,
        MID_SEP_TRIGGER: p.MID_SEP_TRIGGER,
        WALL_TTC_THRESHOLD: p.WALL_TTC_THRESHOLD,
        WALL_PADDING: p.WALL_PADDING,
        K_GAIN: p.K_GAIN,
        G_MIN: p.G_MIN,
        G_MAX: p.G_MAX,
        HORIZON_S: p.HORIZON_S,
        H_DT: p.H_DT,
        OPEN_SAFE_SEP: p.OPEN_SAFE_SEP,
        OPEN_HOLD_S: p.OPEN_HOLD_S,
        OOB_RETURN_AFTER: p.OOB_RETURN_AFTER,
        OOB_RETURN_G: p.OOB_RETURN_G,
        OOB_RELEASE_MARGIN: p.OOB_RELEASE_MARGIN,
        enableMidair: p.enableMidair,
        enableWall: p.enableWall,
        enableGuardrail: p.enableGuardrail,
        enableOOBReturn: p.enableOOBReturn,
      },
      { seeds: 64, minutes: 2, n, nearMiss: 30 }
    );

  const {
    aircraft,
    running,
    time,
    params,
    logs,
    history,
    centerHistory,
    pairs,
    setRunning,
    setParams,
    resetSim,
    resetAndStart,
    fastScoreNow,
    fastScore,
    scoring,
    exportCsv,
    WORLD_W: W,
    WORLD_H: H,
  } = useAirparkSim({
    worldW: WORLD_W,
    worldH: WORLD_H,
    tickHz: TICK_HZ,
    maxAircraft: MAX_AIRCRAFT,
    initialN: 5,
    defaults: DEFAULTS as any,
    startPaused: true, // start paused until user presses Run or Reset & Start
    runFastScore,
  });

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white">
      <HeaderBar
        running={running}
        onToggleRun={() => setRunning((r) => !r)}
        onReset={() => resetSim()}
        onResetStart={() => resetAndStart()}  // fresh experiment start
        onExport={exportCsv}                  // manual CSV export; collisions auto-export JSON packet
      />

      <main className="mx-auto max-w-7xl p-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* RIGHT: Arena */}
        <section className="order-1 xl:order-2 xl:sticky xl:top-[56px] self-start">
          <div className="rounded-2xl bg-[#0f1420] p-3 shadow ring-1 ring-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Arena</div>
              <div className="text-xs text-white/60">
                t={time.toFixed(1)}s · n={aircraft.length}
              </div>
            </div>
            <div className="h[60vh] md:h-[70vh] xl:h-[calc(100vh-120px)]">
              <div className="h-[60vh] md:h-[70vh] xl:h-[calc(100vh-120px)]">
                <ArenaCanvas aircraft={aircraft} worldW={W} worldH={H} />
              </div>
            </div>
          </div>
        </section>

        {/* LEFT: Pairwise + Center charts, then Logs + Controls */}
        <section className="order-2 xl:order-1 grid grid-rows-[auto_auto_minmax(0,1fr)] gap-3 min-h-[calc(100vh-120px)]">
          {/* Pairwise separation chart */}
          <PairwiseChart
            data={history.slice(-600)}
            pairs={pairs}
            showTimeTicks={!running} // hide time ticks while running
          />

          {/* Distance from center chart (restored) */}
          <CenterDistanceChart
            data={centerHistory.slice(-600)}
            ids={aircraft.map((a) => a.id)}
            showTimeTicks={!running} // hide time ticks while running
          />

          {/* Logs + Controls */}
          <div className="grid grid-rows-2 md:grid-rows-1 md:grid-cols-2 gap-3 min-h-0">
            <LogsPanel logs={logs} />
            <ControlsPanel
              params={params}
              setParams={setParams}
              fastScore={fastScore as any}
              scoring={scoring}
              onFastScore={fastScoreNow}
              onRerandomize={() => resetSim()}
              onAddPlane={() => resetSim(aircraft.length + 1)}
              onRemovePlane={() => resetSim(Math.max(2, aircraft.length - 1))}
            />
          </div>
        </section>
      </main>

      <FooterBar />
    </div>
  );
}
