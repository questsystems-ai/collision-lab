"use client";

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
};

export default function Toggle({ label, value, onChange, className }: ToggleProps) {
  return (
    <label
      className={`flex items-center justify-between gap-3 text-sm ${className ?? ""}`}
    >
      <span className="text-white/80">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`h-6 w-10 rounded-full transition ${
          value ? "bg-emerald-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white transform transition ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
