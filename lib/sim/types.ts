// lib/sim/types.ts
export type Vec2 = { x: number; y: number };

export type Controller =
  | { name: "NormalMotion" }
  | {
      name: "ArcTurn";
      direction: 1 | -1;
      gLimit: number;
      totalAngle: number;
      advanced: number;
      source: "midair" | "wall";
      exitFraction: number;
      triggerId?: string;
      done?: boolean;
    }
  | { name: "ReturnToBox"; gLimit: number; desired: Vec2 };

export interface Aircraft {
  id: string;
  color: string;
  pos: Vec2;
  vel: Vec2;
  speed: number;
  targetSpeed: number;
  accel: number;
  decel: number;
  overrides: { midair?: Controller; wall?: Controller };
  motion: Controller;
  lastRespawn: number;
}

export interface Params {
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
}

export interface TriggerLogRow {
  t: number;
  aid: string;
  triggerId: string;
  source: string;
  note: string;
}
