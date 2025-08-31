// lib/sim/predictors.ts
import type { Aircraft, Params, Vec2 } from "./types";
import { clamp, norm, rot, add, mul, dot, len, distance } from "./math";

/** Wall TTC under constant heading. Accept world dims (no global needed). */
export function computeWallTTC(
  a: Aircraft,
  worldW: number,
  worldH: number
): { ttc: number | null; wall: "left" | "right" | "top" | "bottom" | null } {
  const vhat = norm(a.vel);
  const s = a.speed;
  const cands: { wall: "left" | "right" | "top" | "bottom"; t: number }[] = [];
  if (vhat.x < -1e-9) cands.push({ wall: "left", t: -a.pos.x / (vhat.x * s) });
  if (vhat.x > +1e-9) cands.push({ wall: "right", t: (worldW - a.pos.x) / (vhat.x * s) });
  if (vhat.y < -1e-9) cands.push({ wall: "top", t: -a.pos.y / (vhat.y * s) });
  if (vhat.y > +1e-9) cands.push({ wall: "bottom", t: (worldH - a.pos.y) / (vhat.y * s) });
  const pos = cands.filter((c) => c.t >= 0);
  if (pos.length === 0) return { ttc: null, wall: null };
  const best = pos.reduce((m, c) => (c.t < m.t ? c : m));
  return { ttc: best.t, wall: best.wall };
}

/** Midair closest approach (constant-velocity model). */
export function computeMidairTCA(a: Aircraft, b: Aircraft) {
  const r = { x: a.pos.x - b.pos.x, y: a.pos.y - b.pos.y };
  const v = { x: a.vel.x - b.vel.x, y: a.vel.y - b.vel.y };
  const v2 = dot(v, v);
  if (v2 < 1e-12) return { tStar: null, dMin: null };
  const tStar = -dot(r, v) / v2;
  if (tStar < 0) return { tStar: null, dMin: null };
  const dMin = len(add(r, mul(v, tStar)));
  return { tStar, dMin };
}

/** Trigger if TCA <= threshold and closest distance small. */
export function shouldTriggerMidair(a: Aircraft, b: Aircraft, P: Params) {
  const { tStar, dMin } = computeMidairTCA(a, b);
  if (tStar === null || dMin === null) return { trigger: false, tStar, dMin };
  return { trigger: tStar <= P.MID_TTC_THRESHOLD && dMin <= P.MID_SEP_TRIGGER, tStar, dMin };
}

/** Shadow-test L/R arc; pick direction that maximizes min separation. */
export function pickDirectionShadow(a: Aircraft, intr: Aircraft, gLimit: number, P: Params) {
  const test = (dir: 1 | -1) => {
    let pos = { ...a.pos };
    let vel = { ...a.vel };
    let minSep = Infinity;
    const speed = a.speed;
    const omega = (gLimit * 9.81) / (speed || 1e-9);
    const steps = Math.ceil(P.HORIZON_S / P.H_DT);
    for (let k = 0; k < steps; k++) {
      const dv = clamp(omega * P.H_DT, -Math.PI, Math.PI) * dir;
      vel = rot(norm(vel), dv);
      vel = mul(vel, speed);
      pos = add(pos, mul(vel, P.H_DT));
      const intrPos = add(intr.pos, mul(intr.vel, (k + 1) * P.H_DT));
      const d = distance(pos, intrPos);
      if (d < minSep) minSep = d;
    }
    return minSep;
  };
  const left = test(+1);
  const right = test(-1);
  return left >= right ? { dir: 1 as 1, minSep: left } : { dir: -1 as -1, minSep: right };
}

/** Nearest intruder by current separation. */
export function nearestIntruder(a: Aircraft, all: Aircraft[]) {
  let best: { b: Aircraft; d: number } | null = null;
  for (const b of all) {
    if (b.id === a.id) continue;
    const d = distance(a.pos, b.pos);
    if (!best || d < best.d) best = { b, d };
  }
  return best?.b ?? null;
}

/** Unit vector pointing toward nearest point on box (with clamping). */
export function desiredInboundUnit(a: Aircraft, worldW: number, worldH: number): Vec2 {
  const tx = clamp(a.pos.x, 0, worldW);
  const ty = clamp(a.pos.y, 0, worldH);
  const d = { x: tx - a.pos.x, y: ty - a.pos.y };
  const L = Math.hypot(d.x, d.y) || 1e-9;
  return { x: d.x / L, y: d.y / L };
}
