// lib/sim/useAirparkSim.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Aircraft, Params, TriggerLogRow, Vec2 } from "./types";
import { clamp, sub, add, mul, norm, dot, distance, getPairs } from "./math";
import {
  computeWallTTC,
  shouldTriggerMidair,
  pickDirectionShadow,
  nearestIntruder,
  desiredInboundUnit,
} from "./predictors";
import { updateAircraft } from "./controllers";

type RunFastScore = (p: Params, n: number) => Promise<any>;

/* --------------------- Collision policy & chart cadence --------------------- */
const COLLISION_THRESH_M = 10.0;   // stop & export if any pair < 10 m
const COLLISION_WINDOW_S = 10.0;   // export last 10 seconds around collision
const HIST_DT = 0.08;              // chart throttle ~12.5 Hz

/* --------------------------- Pilot (baseline) --------------------------- */
/** Discrete “bump” pilot like your Python NormalMotion:
 *  straight flight with a small heading bump every few seconds.
 */
const PILOT_BUMP_INTERVAL_S = 2.0;            // seconds
const PILOT_BUMP_DEG = 10.0;                  // degrees per bump
const PILOT_BUMP_RAD = (PILOT_BUMP_DEG * Math.PI) / 180;

/* -------------------------------- Helpers ------------------------------- */
function randomColor(i: number) {
  const palette = ["#ffcc66", "#76c7ff", "#a2f38f", "#ff8fa3", "#d0b3ff", "#ffd480", "#9be7ff", "#b3ffcc"];
  return palette[i % palette.length];
}

let __id = 0;
function makeAircraft(i: number, worldW: number, worldH: number): Aircraft {
  const id = `A${++__id}`;
  const pos = { x: Math.random() * worldW, y: Math.random() * worldH };
  const heading = Math.random() * Math.PI * 2;
  const speed = 53.6;
  return {
    id,
    color: randomColor(i),
    pos,
    vel: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
    speed,
    targetSpeed: speed,
    accel: 10,
    decel: 10,
    overrides: {},
    motion: { name: "NormalMotion" },
    lastRespawn: -1e9,
  };
}

function isOutOfBounds(p: Vec2, W: number, H: number) {
  return p.x < 0 || p.x > W || p.y < 0 || p.y > H;
}
function isInsideMargin(p: Vec2, W: number, H: number, m: number) {
  return p.x >= m && p.x <= W - m && p.y >= m && p.y <= H - m;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function downloadCsv(filename: string, lines: string[]) {
  downloadBlob(filename, new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
}

/* ================================ Hook ================================= */
export function useAirparkSim(opts: {
  worldW: number;
  worldH: number;
  tickHz: number;   // informational (we run with real dt)
  maxAircraft?: number;
  initialN?: number;
  defaults: Params;
  startPaused?: boolean;
  runFastScore?: RunFastScore;
}) {
  const {
    worldW: WORLD_W,
    worldH: WORLD_H,
    tickHz: TICK_HZ,
    maxAircraft = 8,
    initialN = 5,
    defaults,
    startPaused = true,
    runFastScore,
  } = opts;

  /* ----------------------------- UI state ----------------------------- */
  const [aircraft, setAircraft] = useState<Aircraft[]>(
    () => Array.from({ length: initialN }, (_, i) => makeAircraft(i, WORLD_W, WORLD_H))
  );
  const [running, setRunning] = useState<boolean>(!startPaused);
  const [time, setTime] = useState(0);
  const [params, setParams] = useState<Params>(defaults);
  const [logs, setLogs] = useState<TriggerLogRow[]>([]);
  const [history, setHistory] = useState<any[]>([]);           // pairwise rows
  const [centerHistory, setCenterHistory] = useState<any[]>([]); // center-distance rows
  const [fastScore, setFastScore] = useState<any>(null);
  const [scoring, setScoring] = useState(false);

  const pairs = useMemo(() => getPairs(aircraft.map((a) => a.id)), [aircraft]);

  /* ----------------------------- Live refs ---------------------------- */
  const aircraftRef = useRef<Aircraft[]>(aircraft);
  const timeRef = useRef<number>(time);
  const paramsRef = useRef<Params>(params);
  const runningRef = useRef<boolean>(running);
  aircraftRef.current = aircraft;
  timeRef.current = time;
  paramsRef.current = params;
  runningRef.current = running;

  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const lastHistWriteRef = useRef<number>(0);

  // Pilot “bump” timers (per aircraft)
  const pilotTimerRef = useRef<Record<string, number>>({}); // seconds since last bump

  /* ---------------------------- CSV buffers --------------------------- */
  const simCsvRef = useRef<string[]>([]);
  const pairCsvRef = useRef<string[]>([]);
  const trigCsvRef = useRef<string[]>([]);
  function initCsvHeaders(aList: Aircraft[]) {
    simCsvRef.current = ["time,aircraft_id,x,y,vx,vy,speed_mps,active_ctrl"];
    const pairCols = getPairs(aList.map(a => a.id)).map(([a,b]) => `${a}-${b}`);
    pairCsvRef.current = ["time,trigger_id," + pairCols.join(",")];
    trigCsvRef.current = ["time,aircraft_id,trigger_id,source,note"];
  }
  useEffect(() => { initCsvHeaders(aircraftRef.current); /* once */ // eslint-disable-next-line
  }, []);

  /* --------------------------- Controls/Scoring ------------------------ */
  async function fastScoreNow() {
    if (!runFastScore) return;
    try { setScoring(true); setFastScore(await runFastScore(paramsRef.current, aircraftRef.current.length)); }
    finally { setScoring(false); }
  }

  function logTrigger(aid: string, triggerId: string, source: string, note: string) {
    const t = timeRef.current;
    const row: TriggerLogRow = { t, aid, triggerId, source, note };
    setLogs((L) => [row, ...L].slice(0, 2000));
    trigCsvRef.current.push(`${t.toFixed(3)},${aid},${triggerId},${source},"${note.replace(/"/g,'""')}"`);
  }

  /* ------------------------------ Triggers ----------------------------- */
  function attemptMidair(a: Aircraft, list: Aircraft[]) {
    const P = paramsRef.current;
    if (!P.enableMidair) return false;
    if (a.overrides.midair && a.overrides.midair.name === "ArcTurn" && a.overrides.midair.source === "midair") return false;

    let best: { b: Aircraft; tca: number; dmin: number } | null = null;
    for (const b of list) {
      if (b.id === a.id) continue;
      const { trigger, tStar, dMin } = shouldTriggerMidair(a, b, P);
      if (trigger && tStar != null && dMin != null) {
        if (!best || tStar < best.tca) best = { b, tca: tStar, dmin: dMin };
      }
    }
    if (!best) return false;

    // (D) g scale by closure/TCA
    const r = sub(best.b.pos, a.pos);
    const rHat = norm(r);
    const vRel = sub(a.vel, best.b.vel);
    const vClosure = Math.max(0, dot(vRel, rHat));
    const tau = 0.5;
    const gNeeded = clamp(P.K_GAIN * vClosure / Math.max(best.tca, tau), P.G_MIN, P.G_MAX);

    // (B) pick side via shadow tests
    const pick = pickDirectionShadow(a, best.b, gNeeded, P);

    const trig = `M${Math.floor(timeRef.current * 1000).toString().padStart(6, "0")}`;
    a.overrides.midair = {
      name: "ArcTurn",
      direction: pick.dir,
      gLimit: gNeeded,
      totalAngle: Math.PI,      // π arc ceiling
      advanced: 0,
      source: "midair",
      exitFraction: 0.5,        // exit at half arc unless guardrail exits earlier
      triggerId: trig,
    };
    logTrigger(a.id, trig, "midair",
      `vs ${best.b.id} tca=${best.tca.toFixed(2)} dmin=${best.dmin.toFixed(1)} projMin=${pick.minSep.toFixed(1)}`
    );
    return true;
  }

  function attemptWall(a: Aircraft) {
    const P = paramsRef.current;
    if (!P.enableWall) return false;
    if (a.overrides.wall) return false;
    const { ttc } = computeWallTTC(a, WORLD_W, WORLD_H);
    if (ttc == null) return false;
    const dist = Math.min(a.pos.x, WORLD_W - a.pos.x, a.pos.y, WORLD_H - a.pos.y);
    if (ttc < P.WALL_TTC_THRESHOLD || dist < P.WALL_PADDING + 5) {
      // turn toward the center side (like your heuristic)
      const toCenter = { x: WORLD_W * 0.5 - a.pos.x, y: WORLD_H * 0.5 - a.pos.y };
      const cross = a.vel.x * toCenter.y - a.vel.y * toCenter.x;
      const direction: 1 | -1 = cross >= 0 ? 1 : -1;
      const trig = `W${Math.floor(timeRef.current * 1000).toString().padStart(6, "0")}`;
      a.overrides.wall = {
        name: "ArcTurn",
        direction,
        gLimit: 3.0,
        totalAngle: Math.PI,
        advanced: 0,
        source: "wall",
        exitFraction: 0.5,
        triggerId: trig,
      };
      logTrigger(a.id, trig, "wall", `ttc~${ttc.toFixed(2)}`);
      return true;
    }
    return false;
  }

  // Return-to-Box arming/updating when OOB
  function oobReturn(a: Aircraft) {
    const P = paramsRef.current;
    if (!P.enableOOBReturn) return;
    if (!isOutOfBounds(a.pos, WORLD_W, WORLD_H)) return;

    // midair has priority
    const midairActive =
      a.overrides.midair?.name === "ArcTurn" &&
      (a.overrides.midair as any).source === "midair";
    if (midairActive) return;

    const already = a.overrides.wall?.name === "ReturnToBox";
    if (already) {
      (a.overrides.wall as any).desired = desiredInboundUnit(a, WORLD_W, WORLD_H);
      return;
    }

    const trig = `RTO${Math.floor(timeRef.current * 1000).toString().padStart(6, "0")}`;
    a.overrides.wall = {
      name: "ReturnToBox",
      gLimit: P.OOB_RETURN_G,
      desired: desiredInboundUnit(a, WORLD_W, WORLD_H),
    };
    logTrigger(a.id, trig, "oob-return", "align to nearest-box-point");
  }

  /* --------------- Collision datapacket (single JSON) ------------------ */
  function exportCollisionPacket(tCollision: number, pair: string, minSep: number) {
    const tStart = Math.max(0, tCollision - COLLISION_WINDOW_S);
    const filter = (lines: string[]) => {
      if (!lines.length) return [];
      const [header, ...rows] = lines;
      const keep = rows.filter((ln) => {
        const t = parseFloat(ln.split(",", 1)[0]);
        return Number.isFinite(t) && t >= tStart && t <= tCollision;
      });
      return [header, ...keep];
    };
    const packet = {
      meta: {
        collision_time_s: +tCollision.toFixed(3),
        collision_pair: pair,
        min_sep_m: +minSep.toFixed(2),
        window_s: COLLISION_WINDOW_S,
        world: { width: WORLD_W, height: WORLD_H },
      },
      sim_log_csv: filter(simCsvRef.current),
      pair_distances_csv: filter(pairCsvRef.current),
      trigger_log_csv: filter(trigCsvRef.current),
    };
    const stamp = Math.round(tCollision * 1000);
    downloadBlob(`coll_${stamp}.json`, new Blob([JSON.stringify(packet)], { type: "application/json" }));
  }

  /* -------------------------- Physics step (dt) ------------------------- */
  function stepPhysics(dt: number) {
    const base = aircraftRef.current;
    const list = base.map((a) => ({ ...a, pos: { ...a.pos }, vel: { ...a.vel }, overrides: { ...a.overrides } }));

    // Priority: midair before wall
    for (const a of list) attemptMidair(a, list) || attemptWall(a);

    // Update + OOB + guardrail
    for (const a of list) {
      const P = paramsRef.current;

      // Pilot bump when on NormalMotion
      if (!a.overrides.midair && !a.overrides.wall && a.motion.name === "NormalMotion") {
        const timers = pilotTimerRef.current;
        timers[a.id] = (timers[a.id] ?? 0) + dt;
        if (timers[a.id] >= PILOT_BUMP_INTERVAL_S) {
          timers[a.id] = 0;
          const sign = Math.random() < 0.5 ? 1 : -1;
          const vhat = norm(a.vel);
          const dtheta = sign * PILOT_BUMP_RAD;
          const c = Math.cos(dtheta), s = Math.sin(dtheta);
          a.vel = mul({ x: vhat.x * c - vhat.y * s, y: vhat.x * s + vhat.y * c }, a.speed);
        }
      }

      // OOB -> ReturnToBox arming
      const wasOOB = isOutOfBounds(a.pos, WORLD_W, WORLD_H);
      const oobMap = oobTimeRef.current;
      if (wasOOB) oobMap[a.id] = (oobMap[a.id] || 0) + dt; else oobMap[a.id] = 0;
      if (P.enableOOBReturn && wasOOB && oobMap[a.id] >= P.OOB_RETURN_AFTER) oobReturn(a);

      // Integrate with real dt
      updateAircraft(a, dt);

      // Release ReturnToBox once safely inside
      if (a.overrides.wall?.name === "ReturnToBox" && isInsideMargin(a.pos, WORLD_W, WORLD_H, P.OOB_RELEASE_MARGIN)) {
        a.overrides.wall = undefined;
        a.motion = { name: "NormalMotion" };
        logTrigger(a.id, "OOB-RELEASE", "oob-return", `inside by ${P.OOB_RELEASE_MARGIN}m`);
      }

      // Guardrail early-exit (E): opening sustained
      if (P.enableGuardrail && a.overrides.midair && a.overrides.midair.name === "ArcTurn" && a.overrides.midair.source === "midair") {
        const intr = nearestIntruder(a, list);
        if (intr) {
          const r = sub(intr.pos, a.pos);
          const rHat = norm(r);
          const vRel = sub(a.vel, intr.vel);
          const rDot = dot(vRel, rHat); // >0 opening
          const key = a.id;
          if (rDot > 0) openTimeRef.current[key] = (openTimeRef.current[key] || 0) + dt; else openTimeRef.current[key] = 0;
          const sep = distance(a.pos, intr.pos);
          if (sep > P.OPEN_SAFE_SEP && (openTimeRef.current[key] || 0) >= P.OPEN_HOLD_S) {
            (a.overrides.midair as any).done = true;
            logTrigger(a.id, (a.overrides.midair as any).triggerId || "M", "midair", `early-exit open sep=${sep.toFixed(1)}`);
          }
        }
      }
    }

    // Cleanup + retrigger if still closing after a midair arc (F)
    for (const a of list) {
      for (const key of ["midair", "wall"] as const) {
        const c = a.overrides[key];
        if (c && c.name === "ArcTurn" && (c as any).done) {
          a.overrides[key] = undefined;
          a.motion = { name: "NormalMotion" };
          if (key === "midair") {
            const intr = nearestIntruder(a, list);
            if (intr) {
              const r = sub(intr.pos, a.pos);
              const rHat = norm(r);
              const vRel = sub(a.vel, intr.vel);
              if (dot(vRel, rHat) < 0 && distance(a.pos, intr.pos) < paramsRef.current.OPEN_SAFE_SEP) {
                attemptMidair(a, list);
              }
            }
          }
        }
      }
    }

    /* -------- collision check, CSV logging, histories -------- */
    const tNext = timeRef.current + dt;
    const pairNames = getPairs(list.map(a => a.id)).map(([a,b]) => `${a}-${b}`);
    const pairVals = pairNames.map((name) => {
      const [A, B] = name.split("-");
      const a = list.find(x => x.id === A)!; const b = list.find(x => x.id === B)!;
      return distance(a.pos, b.pos);
    });
    // min pair
    let minIdx = 0; let minVal = pairVals[0] ?? Infinity;
    for (let i = 1; i < pairVals.length; i++) if (pairVals[i] < minVal) { minVal = pairVals[i]; minIdx = i; }
    const minPairName = pairNames[minIdx] ?? "";

    // sim_log CSV row(s)
    for (const a of list) {
      const active = (a.overrides.midair ? "ArcTurn" : a.overrides.wall ? "ArcTurn" : "NormalMotion");
      simCsvRef.current.push(
        `${tNext.toFixed(3)},${a.id},${a.pos.x.toFixed(2)},${a.pos.y.toFixed(2)},${a.vel.x.toFixed(3)},${a.vel.y.toFixed(3)},${a.speed.toFixed(2)},${active}`
      );
    }
    // pair_distances CSV row
    const activeTrigs: string[] = [];
    for (const a of list) {
      const mid = a.overrides.midair as any;
      const wal = a.overrides.wall as any;
      if (mid?.triggerId) activeTrigs.push(`${mid.triggerId}:midair:${a.id}`);
      if (wal?.triggerId) activeTrigs.push(`${wal.triggerId}:wall:${a.id}`);
    }
    const trigStr = activeTrigs.sort().join("|");
    pairCsvRef.current.push(`${tNext.toFixed(3)},${trigStr},${pairVals.map(v=>v.toFixed(2)).join(",")}`);

    // commit live refs + state
    aircraftRef.current = list;
    setAircraft(list);
    timeRef.current = tNext;
    setTime(tNext);

    // throttled histories
    if (tNext - lastHistWriteRef.current >= HIST_DT) {
      lastHistWriteRef.current = tNext;

      // pairwise
      const row: any = { t: Number(tNext.toFixed(2)) };
      for (let i = 0; i < pairNames.length; i++) row[pairNames[i]] = Number(pairVals[i].toFixed(1));
      setHistory((H) => {
        const next = [...H, row];
        const MAX = 120 * (1 / HIST_DT);
        return next.slice(-MAX);
      });

      // center distances
      const cx = WORLD_W * 0.5, cy = WORLD_H * 0.5;
      const cRow: any = { t: Number(tNext.toFixed(2)) };
      for (const a of list) cRow[a.id] = Number(Math.hypot(a.pos.x - cx, a.pos.y - cy).toFixed(1));
      setCenterHistory((H) => {
        const next = [...H, cRow];
        const MAX = 120 * (1 / HIST_DT);
        return next.slice(-MAX);
      });
    }

    // collision handling
    if (minVal < COLLISION_THRESH_M) {
      logTrigger(minPairName.split("-")[0] || "", `C${Math.round(tNext*1000)}`, "collision",
        `pair ${minPairName} d=${minVal.toFixed(2)}m`);
      runningRef.current = false; setRunning(false);
      exportCollisionPacket(tNext, minPairName, minVal);
    }
  }

  /* -------------------------- rAF driver (real dt) --------------------- */
  const openTimeRef = useRef<Record<string, number>>({});
  const oobTimeRef = useRef<Record<string, number>>({});

  useEffect(() => {
    function step(ts: number) {
      const last = lastTs.current;
      lastTs.current = ts;
      if (last != null && runningRef.current) {
        const dt = Math.min(Math.max((ts - last) / 1000, 0), 0.06); // clamp 0..60ms
        stepPhysics(dt);
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []); // once

  /* ----------------------------- Public API ---------------------------- */
  function resetSim(n?: number) {
    __id = 0;
    const N = clamp(n ?? aircraftRef.current.length, 2, maxAircraft);
    const next = Array.from({ length: N }, (_, i) => makeAircraft(i, WORLD_W, WORLD_H));
    aircraftRef.current = next; setAircraft(next);
    setLogs([]); setHistory([]); setCenterHistory([]); setTime(0);
    timeRef.current = 0; lastTs.current = null; lastHistWriteRef.current = 0;
    pilotTimerRef.current = {};
    initCsvHeaders(next);
  }
  function resetAndStart(n?: number) {
    resetSim(n);
    setRunning(true); runningRef.current = true;
  }
  function exportCsv() {
    downloadCsv("sim_log.csv", simCsvRef.current);
    downloadCsv("pair_distances.csv", pairCsvRef.current);
    downloadCsv("trigger_log.csv", trigCsvRef.current);
  }

  return {
    aircraft, running, time, params, logs, history, centerHistory, pairs,
    setRunning: (v: boolean | ((r: boolean) => boolean)) => {
      const val = typeof v === "function" ? (v as any)(runningRef.current) : v;
      runningRef.current = val; setRunning(val);
    },
    setParams: (updater: any) => {
      const next = typeof updater === "function" ? updater(paramsRef.current) : updater;
      paramsRef.current = next; setParams(next);
    },
    resetSim, resetAndStart,
    fastScoreNow, fastScore, scoring,
    exportCsv,
    WORLD_W, WORLD_H, TICK_HZ, maxAircraft,
  };
}
