// lib/sim/controllers.ts
import type { Aircraft } from "./types";
import { clamp, norm, rot, mul, add } from "./math";

/** Apply active controller, then integrate one step. */
export function updateAircraft(a: Aircraft, dt: number) {
  // speed convergence
  const dv = a.targetSpeed - a.speed;
  const accel = clamp(dt ? dv / dt : 0, -a.decel, a.accel);
  a.speed += accel * dt;

  // active controller
  const active = a.overrides.midair || a.overrides.wall || a.motion;
  if (active.name === "ArcTurn") {
    const vhat = norm(a.vel);
    const omega = (active.gLimit * 9.81) / (a.speed || 1e-9);
    const dtheta = clamp(omega * dt, -Math.PI, Math.PI) * active.direction;
    a.vel = mul(rot(vhat, dtheta), a.speed);
    active.advanced += Math.abs(dtheta);
    const frac = active.advanced / (active.totalAngle || Math.PI);
    if (frac >= active.exitFraction) (active as any).done = true;
  } else if (active.name === "ReturnToBox") {
    const vhat = norm(a.vel);
    const omega = (active.gLimit * 9.81) / (a.speed || 1e-9);
    const cross = vhat.x * active.desired.y - vhat.y * active.desired.x;
    const dotp = clamp(vhat.x * active.desired.x + vhat.y * active.desired.y, -1, 1);
    const ang = Math.atan2(cross, dotp);
    const dtheta = clamp(ang, -omega * dt, omega * dt);
    a.vel = mul(rot(vhat, dtheta), a.speed);
  }
  // integrate position (also re-normalize)
  a.vel = mul(norm(a.vel), a.speed);
  a.pos = add(a.pos, mul(a.vel, dt));
}
