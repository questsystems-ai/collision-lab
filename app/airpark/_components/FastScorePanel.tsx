"use client";

type FastScore = {
  lambda_per_hour: number;
  ten_year_risk: number;
  collisions: number;
  near_misses: number;
  avg_sep: number;
  system_frac: number;
} | null;

export default function FastScorePanel({
  fastScore,
  className,
}: {
  fastScore: FastScore;
  className?: string;
}) {
  if (!fastScore) return null;
  return (
    <div
      className={
        className ??
        "grid grid-cols-2 gap-2 text-xs text-white/80 rounded-xl border border-white/10 p-2"
      }
    >
      <div>
        λ (collisions/hr):{" "}
        <span className="font-semibold">
          {fastScore.lambda_per_hour.toFixed(3)}
        </span>
      </div>
      <div>
        10-yr risk:{" "}
        <span className="font-semibold">
          {(fastScore.ten_year_risk * 100).toFixed(2)}%
        </span>
      </div>
      <div>
        collisions: <span className="font-semibold">{fastScore.collisions}</span>
      </div>
      <div>
        near-misses (&lt;30m):{" "}
        <span className="font-semibold">{fastScore.near_misses}</span>
      </div>
      <div>
        avg sep:{" "}
        <span className="font-semibold">{fastScore.avg_sep.toFixed(1)} m</span>
      </div>
      <div>
        system duty:{" "}
        <span className="font-semibold">
          {(fastScore.system_frac * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
