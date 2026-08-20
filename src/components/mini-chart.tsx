import type { SparkPoint } from "@/lib/analysis";

export function MiniChart({
  points,
  up,
}: {
  points: SparkPoint[];
  up?: boolean;
}) {
  if (points.length < 4) {
    return <span className="block h-8 w-[5.5rem] text-center font-mono text-[9px] leading-8 text-subtle">—</span>;
  }
  const w = 88;
  const h = 32;
  const pad = 1;
  const ys = points.flatMap((p) => [p.c, p.u, p.l].filter((v): v is number => v != null && Number.isFinite(v)));
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const bandPts = points
    .map((p, i) => ({ i, u: p.u, l: p.l }))
    .filter((p): p is { i: number; u: number; l: number } => p.u != null && p.l != null);
  const band =
    bandPts.length >= 3
      ? [
          ...bandPts.map((p, n) => `${n === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.u).toFixed(1)}`),
          ...[...bandPts].reverse().map((p) => `L${x(p.i).toFixed(1)},${y(p.l).toFixed(1)}`),
          "Z",
        ].join(" ")
      : null;
  const mid = points
    .map((p, i) =>
      p.m == null ? "" : `${i === 0 || points[i - 1]?.m == null ? "M" : "L"}${x(i).toFixed(1)},${y(p.m).toFixed(1)}`,
    )
    .join(" ");
  const stroke = up === false ? "var(--color-down)" : "var(--color-up)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[5.5rem] overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`miniFill-${up ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {band && <path d={band} fill="var(--color-bb)" fillOpacity="0.22" />}
      {mid && <path d={mid} fill="none" stroke="var(--color-sma20)" strokeWidth="0.9" />}
      <path d={`${line} L${x(points.length - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`} fill={`url(#miniFill-${up ? "u" : "d"})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" />
    </svg>
  );
}
