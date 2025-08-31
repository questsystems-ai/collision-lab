"use client";

export default function ParamGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-xl border border-white/10 p-3">
      <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
