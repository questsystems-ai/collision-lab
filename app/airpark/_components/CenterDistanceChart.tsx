"use client";

import { Radar } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";

type CenterDistanceChartProps = {
  data: Array<Record<string, number>>; // rows like { t: number, A1: number, A2: number, ... }
  ids: string[];                        // ["A1","A2",...]
  title?: string;
  className?: string;
  heightClassName?: string;
  showTimeTicks?: boolean;
};

function useSmoothedMax(series: Array<Record<string, number>>, keys: string[], pad = 1.1) {
  const [ymax, setYmax] = useState(100);
  const emaRef = useRef<number>(100);
  useEffect(() => {
    if (!series.length || !keys.length) return;
    const last = series[series.length - 1];
    let localMax = 0;
    for (const k of keys) {
      const v = Number(last[k] ?? 0);
      if (Number.isFinite(v)) localMax = Math.max(localMax, v);
    }
    const target = Math.max(100, Math.ceil(localMax * pad));
    const ema = emaRef.current * 0.85 + target * 0.15;
    emaRef.current = ema;
    setYmax(Math.max(100, Math.round(ema)));
  }, [series, keys, pad]);
  return ymax;
}

export default function CenterDistanceChart({
  data,
  ids,
  title = "Distance from Center (live)",
  className,
  heightClassName = "h-[28vh] md:h-[34vh] xl:h-[36vh]",
  showTimeTicks = false,
}: CenterDistanceChartProps) {
  const ymax = useSmoothedMax(data, ids, 1.10);

  return (
    <div className={className ?? "rounded-2xl bg-[#0f1420] p-3 shadow ring-1 ring-white/10"}>
      <div className="flex items-center gap-2 mb-2">
        <Radar className="w-4 h-4 text-cyan-300" />
        <span className="font-medium">{title}</span>
      </div>
      <div className={heightClassName}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <XAxis
              dataKey="t"
              tick={showTimeTicks ? { fill: "#9ba3af" } : false}
              tickLine={showTimeTicks}
              axisLine={true}
              allowDecimals={false}
            />
            <YAxis tick={{ fill: "#9ba3af" }} domain={[0, ymax]} allowDataOverflow />
            <Tooltip
              contentStyle={{
                background: "#0b0e14",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                color: "white",
              }}
            />
            <Legend wrapperStyle={{ color: "#cbd5e1" }} />
            {ids.map((id) => (
              <Line key={id} type="monotone" dataKey={id} dot={false} strokeWidth={1.8} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
