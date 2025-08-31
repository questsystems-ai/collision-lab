// lib/sim/math.ts
import type { Vec2 } from "./types";

export const clamp = (x: number, lo: number, hi: number) =>
  x < lo ? lo : x > hi ? hi : x;

export const len = (v: Vec2) => Math.hypot(v.x, v.y);
export const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const norm = (v: Vec2): Vec2 => {
  const L = len(v) || 1e-9;
  return { x: v.x / L, y: v.y / L };
};
export const rot = (v: Vec2, ang: number): Vec2 => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
};

export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function getPairs(ids: string[]) {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  return pairs;
}
