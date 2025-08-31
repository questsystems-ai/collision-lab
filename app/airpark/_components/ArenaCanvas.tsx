"use client";

import React, { useEffect, useRef } from "react";

type Vec2 = { x: number; y: number };
export type AircraftLike = {
  id: string;
  color: string;
  pos: Vec2;
  vel: Vec2;
  speed: number;
};

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

type ArenaCanvasProps = {
  aircraft: AircraftLike[];
  worldW: number;
  worldH: number;
  className?: string;
};

/**
 * Pure drawing component. Owns a lightweight rAF loop that
 * renders the current aircraft positions & short “shadow” paths.
 * No physics here — that stays in the parent.
 */
export default function ArenaCanvas({
  aircraft,
  worldW,
  worldH,
  className,
}: ArenaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let mounted = true;

    const render = () => {
      if (!mounted) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // scales world meters -> pixels
      const sx = w / worldW;
      const sy = h / worldH;

      // background + border
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0b0e14";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#2a2f3a";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, worldW * sx, worldH * sy);

      // draw each aircraft and a forward “shadow”
      for (const a of aircraft) {
        const x = a.pos.x * sx;
        const y = a.pos.y * sy;

        // shadow (short constant-velocity projection)
        ctx.strokeStyle = "#88aaff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        let sp = { ...a.pos };
        const sv = { ...a.vel };
        for (let i = 0; i < 40; i++) {
          sp = add(sp, mul(sv, 0.05)); // 0.05s steps, 2s total
          const px = sp.x * sx;
          const py = sp.y * sy;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // body
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [aircraft, worldW, worldH]);

  return (
    <canvas
      ref={canvasRef}
      className={
        className ??
        "w-full h-full rounded-xl border border-white/10 bg-gradient-to-b from-[#0b0e14] to-[#0c1220]"
      }
    />
  );
}
