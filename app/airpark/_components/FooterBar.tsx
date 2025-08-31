"use client";

export default function FooterBar({
  text = "The challenge: build an Airpark where many planes fly in a confined space. Any collision is fatal. Tweak parameters and avoidance combinations to explore emergent flight patterns.",
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <footer className={className ?? "mx-auto max-w-7xl p-6 text-xs text-white/50"}>
      {text}
    </footer>
  );
}
