"use client";

import Slider from "./Slider";

export default function TwoSlider({
  labelA,
  labelB,
  min,
  max,
  step,
  valueA,
  valueB,
  onChangeA,
  onChangeB,
}: {
  labelA: string;
  labelB: string;
  min: number;
  max: number;
  step: number;
  valueA: number;
  valueB: number;
  onChangeA: (v: number) => void;
  onChangeB: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Slider
        label={labelA}
        min={min}
        max={max}
        step={step}
        value={valueA}
        onChange={onChangeA}
      />
      <Slider
        label={labelB}
        min={min}
        max={max}
        step={step}
        value={valueB}
        onChange={onChangeB}
      />
    </div>
  );
}
