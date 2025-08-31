"use client";

export default function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
      <div>
        <div className="text-white/80">{label}</div>
        <input
          type="range"
          className="w-full"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="text-white/70 tabular-nums min-w-[64px] text-right">
        {value.toFixed(2)}
      </div>
    </div>
  );
}
