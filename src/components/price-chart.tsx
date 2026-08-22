import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Customized,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn, formatCompact, formatMoney } from "@/lib/utils";

export type ChartPoint = {
  t: number;
  o?: number;
  h?: number;
  l?: number;
  c: number;
  v?: number;
  sma20: number | null;
  sma50?: number | null;
  sma200?: number | null;
  mid?: number | null;
  upper: number | null;
  lower: number | null;
  rsi?: number | null;
  macd?: number | null;
  signal?: number | null;
  hist?: number | null;
  up?: boolean;
  bbBase?: number | null;
  bbWidth?: number | null;
};

type Overlay = "bb" | "sma20" | "sma50" | "sma200";
type Range = "1m" | "3m" | "6m";

const OVERLAYS: {
  id: Overlay;
  label: string;
  swatch: string;
  hint: string;
}[] = [
  {
    id: "bb",
    label: "Bollinger",
    swatch: "bg-bb",
    hint: "Canal de volatilidad. Bueno = zona media. Malo = pegado a una banda.",
  },
  {
    id: "sma20",
    label: "SMA 20",
    swatch: "bg-sma20",
    hint: "Promedio 20 días. Bueno = precio encima. Malo = debajo.",
  },
  {
    id: "sma50",
    label: "SMA 50",
    swatch: "bg-sma50",
    hint: "Promedio 50 días. Bueno = encima. Malo = debajo.",
  },
  {
    id: "sma200",
    label: "SMA 200",
    swatch: "bg-sma200",
    hint: "Promedio ~1 año. Bueno = encima. Malo = debajo.",
  },
];

const RANGES: { id: Range; label: string; bars: number }[] = [
  { id: "1m", label: "1M", bars: 22 },
  { id: "3m", label: "3M", bars: 66 },
  { id: "6m", label: "6M", bars: 130 },
];

function axisTick(v: number) {
  return format(v, "d MMM", { locale: es });
}

function CandleLayer(props: {
  xAxisMap?: Record<string, { scale?: (v: unknown) => number; bandwidth?: () => number }>;
  yAxisMap?: Record<string, { scale?: (v: number) => number; yAxisId?: string | number }>;
  data: ChartPoint[];
}) {
  const xAxis = Object.values(props.xAxisMap ?? {})[0];
  const axes = Object.values(props.yAxisMap ?? {});
  const yAxis = axes.find((ax) => ax.yAxisId === "price") ?? axes[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;
  const bw = Math.max(2, (xAxis.bandwidth?.() ?? 6) * 0.55);
  return (
    <g>
      {props.data.map((p, i) => {
        const x0 = Number(xAxis.scale?.(p.t));
        const x = Number.isFinite(x0) ? x0 : Number(xAxis.scale?.(i));
        if (!Number.isFinite(x)) return null;
        const o = p.o ?? p.c;
        const hi = p.h ?? p.c;
        const lo = p.l ?? p.c;
        const yO = yAxis.scale?.(o) ?? 0;
        const yC = yAxis.scale?.(p.c) ?? 0;
        const yH = yAxis.scale?.(hi) ?? 0;
        const yL = yAxis.scale?.(lo) ?? 0;
        const up = p.c >= o;
        const color = up ? "var(--color-up)" : "var(--color-down)";
        const cx = x + (xAxis.bandwidth?.() ?? bw) / 2;
        return (
          <g key={p.t}>
            <line x1={cx} y1={yH} x2={cx} y2={yL} stroke={color} strokeWidth={1.4} />
            <rect
              x={cx - bw / 2}
              y={Math.min(yO, yC)}
              width={bw}
              height={Math.max(Math.abs(yC - yO), 1.2)}
              fill={color}
            />
          </g>
        );
      })}
    </g>
  );
}

function BollingerFill(props: {
  formattedGraphicalItems?: Array<{
    props?: { dataKey?: string; points?: Array<{ x: number; y: number }> };
    item?: { props?: { dataKey?: string } };
  }>;
  xAxisMap?: Record<string, { scale?: (v: unknown) => number }>;
  yAxisMap?: Record<string, { scale?: (v: number) => number; yAxisId?: string | number }>;
  data: ChartPoint[];
}) {
  const grab = (key: string) => {
    for (const it of props.formattedGraphicalItems ?? []) {
      const dk = it.props?.dataKey ?? it.item?.props?.dataKey;
      const pts = it.props?.points;
      if (dk === key && pts?.length) {
        return pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      }
    }
    return [] as Array<{ x: number; y: number }>;
  };
  let upper = grab("upper");
  let lower = grab("lower");
  if (upper.length < 3 || lower.length < 3) {
    const xAxis = Object.values(props.xAxisMap ?? {})[0];
    const axes = Object.values(props.yAxisMap ?? {});
    const yAxis = axes.find((ax) => ax.yAxisId === "price") ?? axes[0];
    if (xAxis?.scale && yAxis?.scale) {
      const pts = props.data.filter((p) => p.upper != null && p.lower != null);
      upper = pts.map((p, i) => {
        const x = Number(xAxis.scale?.(p.t));
        return { x: Number.isFinite(x) ? x : Number(xAxis.scale?.(i)), y: Number(yAxis.scale?.(p.upper as number)) };
      });
      lower = pts.map((p, i) => {
        const x = Number(xAxis.scale?.(p.t));
        return { x: Number.isFinite(x) ? x : Number(xAxis.scale?.(i)), y: Number(yAxis.scale?.(p.lower as number)) };
      });
    }
  }
  const n = Math.min(upper.length, lower.length);
  if (n < 3) return null;
  upper = upper.slice(0, n);
  lower = lower.slice(0, n);
  const d = `M${upper.map((p) => `${p.x},${p.y}`).join("L")}L${[...lower].reverse().map((p) => `${p.x},${p.y}`).join("L")}Z`;
  return <path d={d} fill="var(--color-bb)" fillOpacity={0.18} stroke="none" />;
}

export function PriceChart({
  series,
  currency,
  target,
  em,
}: {
  series: ChartPoint[];
  currency: string;
  target?: { price: number; label: string } | null;
  em?: { low: number; high: number } | null;
}) {
  const [on, setOn] = useState<Record<Overlay, boolean>>({
    bb: true,
    sma20: true,
    sma50: true,
    sma200: false,
  });
  const [range, setRange] = useState<Range>("3m");
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const data = useMemo(() => {
    const ready = series.filter((p) => Number.isFinite(p.c));
    const n = RANGES.find((r) => r.id === range)?.bars ?? 66;
    return ready.slice(-n).map((p) => ({
      ...p,
      bbBase: p.lower ?? null,
      bbWidth: p.upper != null && p.lower != null ? p.upper - p.lower : null,
    }));
  }, [range, series]);

  const { yMin, yMax, last } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of data) {
      min = Math.min(min, p.l ?? p.c, on.bb && p.lower != null ? p.lower : p.c);
      max = Math.max(max, p.h ?? p.c, on.bb && p.upper != null ? p.upper : p.c);
    }
    if (target?.price) {
      min = Math.min(min, target.price);
      max = Math.max(max, target.price);
    }
    if (em?.low) min = Math.min(min, em.low);
    if (em?.high) max = Math.max(max, em.high);
    const pad = (max - min) * 0.1 || 1;
    return {
      yMin: min - pad,
      yMax: max + pad,
      last: data.at(-1),
    };
  }, [data, on.bb, target?.price, em?.low, em?.high]);

  const tipStyle = {
    background: "var(--color-raised)",
    border: "1px solid var(--color-line)",
    borderRadius: 0,
    color: "var(--color-fg)",
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                "h-6 min-w-8 px-1.5 text-[10px]",
                range === item.id ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {last && <LevelGuide last={last} />}
        <div className="grid w-full grid-cols-1 gap-1 sm:grid-cols-2">
          {OVERLAYS.filter((item) => item.id !== "sma200" || last?.sma200 != null).map((item) => {
            const meter = overlayMeter(item.id, last);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setOn((s) => ({ ...s, [item.id]: !s[item.id] }))}
                className={cn(
                  "border px-1.5 py-1 text-left",
                  on[item.id] ? "border-line-strong bg-raised" : "border-line bg-bg/40 opacity-70",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 shrink-0 rounded-full", item.swatch)} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {meter && (
                    <span
                      className={cn(
                        "ml-auto text-[9px] font-semibold tracking-wide uppercase",
                        meter.tone === "up" && "text-up",
                        meter.tone === "down" && "text-down",
                        meter.tone === "wait" && "text-wait",
                      )}
                    >
                      {meter.tag}
                    </span>
                  )}
                </span>
                <p className="mt-0.5 text-[9px] leading-snug text-muted">{item.hint}</p>
                {meter && (
                  <>
                    <ToneBar pct={meter.pos} kind={meter.kind} />
                    <span className="mt-0.5 flex justify-between text-[8px] text-subtle">
                      <span>{meter.left}</span>
                      <span>{meter.center}</span>
                      <span>{meter.right}</span>
                    </span>
                    <p
                      className={cn(
                        "mt-0.5 text-[9px] leading-snug",
                        meter.tone === "up" && "text-up",
                        meter.tone === "down" && "text-down",
                        meter.tone === "wait" && "text-wait",
                      )}
                    >
                      {meter.detail}
                    </p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "border border-line bg-[#05070b] p-1.5",
          full && "fixed inset-0 z-50 flex flex-col p-3",
        )}
      >
        <div className="mb-0.5 flex items-center justify-between gap-2 px-1">
          <p className="text-[9px] tracking-[0.12em] text-accent uppercase">Precio · flujo</p>
          <div className="flex items-center gap-2">
            {last && (
              <p className="font-mono text-xs tabular-nums text-accent">
                {formatMoney(last.c, currency)}
              </p>
            )}
            <button
              type="button"
              onClick={() => setFull((v) => !v)}
              className="inline-flex h-7 items-center gap-1 border border-line-strong bg-raised px-2 text-[10px] tracking-wide text-accent uppercase hover:bg-surface"
              title={full ? "Salir (Esc)" : "Pantalla completa"}
            >
              {full ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              {full ? "Salir" : "Completa"}
            </button>
          </div>
        </div>
        <div className={cn("w-full", full ? "min-h-0 flex-1" : "h-64 sm:h-80")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pxFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid stroke="var(--color-accent)" vertical strokeOpacity={0.16} />
              <XAxis dataKey="t" hide />
              <YAxis
                yAxisId="price"
                orientation="right"
                domain={[yMin, yMax]}
                allowDataOverflow
                width={56}
                tick={{ fill: "var(--color-accent)", fontSize: 10, opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  Number(v).toLocaleString("es-US", { maximumFractionDigits: 0 })
                }
              />
              <YAxis yAxisId="vol" hide domain={[0, (dataMax: number) => dataMax * 3.2]} />
              {em && (
                <ReferenceLine
                  yAxisId="price"
                  y={em.high}
                  stroke="var(--color-accent)"
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                  label={{ value: "EM+", fill: "var(--color-accent)", fontSize: 9, position: "insideTopLeft" }}
                />
              )}
              {em && (
                <ReferenceLine
                  yAxisId="price"
                  y={em.low}
                  stroke="var(--color-accent)"
                  strokeDasharray="2 4"
                  strokeOpacity={0.7}
                  label={{ value: "EM−", fill: "var(--color-accent)", fontSize: 9, position: "insideBottomLeft" }}
                />
              )}
              {target && (
                <ReferenceLine
                  yAxisId="price"
                  y={target.price}
                  stroke="var(--color-sma20)"
                  strokeDasharray="4 3"
                  label={{
                    value: target.label,
                    fill: "var(--color-sma20)",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              )}
              <Tooltip
                contentStyle={tipStyle}
                labelFormatter={(v) => format(Number(v), "d MMM yyyy", { locale: es })}
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value : Number(value);
                  const labels: Record<string, string> = {
                    h: "Máximo",
                    c: "Cierre",
                    o: "Apertura",
                    l: "Mínimo",
                    v: "Volumen",
                    upper: "BB sup.",
                    lower: "BB inf.",
                    mid: "BB media",
                    sma20: "SMA 20",
                    sma50: "SMA 50",
                    sma200: "SMA 200",
                  };
                  if (String(name) === "v") return [formatCompact(n), "Volumen"];
                  if (String(name) === "bbWidth" || String(name) === "bbBase") return [];
                  return [Number.isFinite(n) ? formatMoney(n, currency) : "—", labels[String(name)] ?? String(name)];
                }}
              />
              <Bar yAxisId="vol" dataKey="v" maxBarSize={10}>
                {data.map((p) => (
                  <Cell key={`v-${p.t}`} fill="var(--color-accent)" fillOpacity={p.up ? 0.45 : 0.18} />
                ))}
              </Bar>
              <Area
                yAxisId="price"
                type="linear"
                dataKey="c"
                stroke="none"
                fill="url(#pxFill)"
                baseValue={yMin}
                isAnimationActive={false}
              />
              {on.bb && (
                <Customized component={(rest: object) => <BollingerFill {...rest} data={data} />} />
              )}
              {on.bb && (
                <Line
                  yAxisId="price"
                  type="linear"
                  dataKey="upper"
                  stroke="var(--color-bb)"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {on.bb && (
                <Line
                  yAxisId="price"
                  type="linear"
                  dataKey="lower"
                  stroke="var(--color-bb)"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {on.bb && (
                <Line
                  yAxisId="price"
                  type="linear"
                  dataKey="mid"
                  stroke="var(--color-fg)"
                  strokeWidth={1}
                  dot={false}
                  strokeDasharray="3 3"
                  strokeOpacity={0.55}
                  isAnimationActive={false}
                />
              )}
              {on.sma20 && (
                <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="var(--color-sma20)" strokeWidth={2.2} dot={false} filter="url(#lineGlow)" />
              )}
              {on.sma50 && (
                <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="var(--color-sma50)" strokeWidth={2.2} dot={false} filter="url(#lineGlow)" />
              )}
              {on.sma200 && (
                <Line yAxisId="price" type="monotone" dataKey="sma200" stroke="var(--color-sma200)" strokeWidth={2} dot={false} filter="url(#lineGlow)" />
              )}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="c"
                stroke="var(--color-accent)"
                strokeWidth={2.4}
                dot={false}
                filter="url(#lineGlow)"
              />
              <Customized component={(rest: object) => <CandleLayer {...rest} data={data} />} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 px-1 text-[9px] tracking-[0.12em] text-accent uppercase">
          RSI 14{last?.rsi != null ? ` · ${last.rsi.toFixed(1)}` : ""}
        </p>
        <div className={cn("w-full", full ? "h-28 shrink-0" : "h-20")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rsiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-sma50)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--color-sma50)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-accent)" vertical strokeOpacity={0.1} />
              <YAxis
                domain={[0, 100]}
                orientation="right"
                width={56}
                ticks={[30, 70]}
                tick={{ fill: "var(--color-accent)", fontSize: 10, opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <XAxis dataKey="t" hide />
              <ReferenceLine y={70} stroke="var(--color-down)" strokeDasharray="3 3" strokeOpacity={0.8} />
              <ReferenceLine y={30} stroke="var(--color-up)" strokeDasharray="3 3" strokeOpacity={0.8} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => [Number(v).toFixed(1), "RSI"]} />
              <Area type="monotone" dataKey="rsi" stroke="var(--color-sma50)" fill="url(#rsiFill)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 px-1 text-[9px] tracking-[0.12em] text-accent uppercase">MACD</p>
        <div className={cn("w-full", full ? "h-32 shrink-0" : "h-24")}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--color-accent)" vertical strokeOpacity={0.1} />
              <XAxis
                dataKey="t"
                tickFormatter={axisTick}
                minTickGap={28}
                tick={{ fill: "var(--color-accent)", fontSize: 10, opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                width={56}
                tick={{ fill: "var(--color-accent)", fontSize: 10, opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => Number(v).toFixed(1)}
              />
              <Tooltip
                contentStyle={tipStyle}
                labelFormatter={(v) => format(Number(v), "d MMM yyyy", { locale: es })}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    macd: "MACD",
                    signal: "Señal",
                    hist: "Hist.",
                  };
                  return [Number(value).toFixed(2), labels[String(name)] ?? String(name)];
                }}
              />
              <Bar dataKey="hist" maxBarSize={7}>
                {data.map((p) => (
                  <Cell
                    key={`h-${p.t}`}
                    fill={(p.hist ?? 0) >= 0 ? "var(--color-accent)" : "var(--color-sma50)"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              <Line type="monotone" dataKey="macd" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="signal" stroke="var(--color-sma50)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function overlayMeter(id: Overlay, last?: ChartPoint) {
  if (!last) return null;
  const px = last.c;
  if (id === "bb") {
    const lo = last.lower;
    const hi = last.upper;
    const mid = last.mid ?? (lo != null && hi != null ? (lo + hi) / 2 : null);
    if (lo == null || hi == null || hi <= lo || mid == null) return null;
    const pos = Math.max(0, Math.min(100, ((px - lo) / (hi - lo)) * 100));
    const toMid = ((mid - px) / px) * 100;
    const gap = Math.abs(toMid).toFixed(1);
    if (pos <= 20) {
      return {
        pos,
        kind: "bb" as const,
        tone: "down" as const,
        tag: "MALO",
        left: "Banda inf. malo",
        center: "Media bueno",
        right: "Banda sup. malo",
        detail: `Estirado abajo. Bueno = volver a ${formatMoney(mid)}. Faltan ${gap}% al alza.`,
      };
    }
    if (pos >= 80) {
      return {
        pos,
        kind: "bb" as const,
        tone: "down" as const,
        tag: "MALO",
        left: "Banda inf. malo",
        center: "Media bueno",
        right: "Banda sup. malo",
        detail: `Estirado arriba. Bueno = volver a ${formatMoney(mid)}. Faltan ${gap}% a la baja.`,
      };
    }
    if (pos <= 35 || pos >= 65) {
      return {
        pos,
        kind: "bb" as const,
        tone: "wait" as const,
        tag: "REGULAR",
        left: "Banda inf. malo",
        center: "Media bueno",
        right: "Banda sup. malo",
        detail: `Cerca del borde. Bueno = zona media (${formatMoney(mid)}). Faltan ${gap}%.`,
      };
    }
    return {
      pos,
      kind: "bb" as const,
      tone: "up" as const,
      tag: "BUENO",
      left: "Banda inf. malo",
      center: "Media bueno",
      right: "Banda sup. malo",
      detail: `En zona media. Colchón ${gap}% hasta la media ${formatMoney(mid)}.`,
    };
  }
  const sma = id === "sma20" ? last.sma20 : id === "sma50" ? last.sma50 : last.sma200;
  if (sma == null || sma <= 0) return null;
  const move = ((px - sma) / sma) * 100;
  const pos = Math.max(0, Math.min(100, 50 + move * (50 / 6)));
  const gap = Math.abs(move).toFixed(1);
  const base = {
    pos,
    kind: "sma" as const,
    left: "Debajo malo",
    center: `Meta ${formatMoney(sma)}`,
    right: "Encima bueno",
  };
  if (move <= -0.35) {
    return {
      ...base,
      tone: "down" as const,
      tag: "MALO",
      detail: `${gap}% debajo. Bueno = cruzar ${formatMoney(sma)}. Faltan ${gap}% al alza.`,
    };
  }
  if (move >= 0.35) {
    return {
      ...base,
      tone: "up" as const,
      tag: "BUENO",
      detail: `${gap}% encima de ${formatMoney(sma)}. Colchón ${gap}% hasta perder la media.`,
    };
  }
  return {
    ...base,
    tone: "wait" as const,
    tag: "EN LA META",
    detail: `Pegado a ${formatMoney(sma)}. Un alza lo pone en bueno; una baja, en malo.`,
  };
}

function ToneBar({ pct, kind }: { pct: number; kind: "sma" | "bb" }) {
  const fill =
    kind === "bb"
      ? "linear-gradient(90deg,#ff3d6e 0%,#f0c14b 22%,#1ee08a 50%,#f0c14b 78%,#ff3d6e 100%)"
      : "linear-gradient(90deg,#ff3d6e 0%,#f0c14b 50%,#1ee08a 100%)";
  return (
    <div className="relative mt-1 h-1.5" style={{ background: fill }}>
      <span
        className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white"
        style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}
      />
    </div>
  );
}

type GuideMark = { id: string; v: number; label: string; color: string };

function LevelGuide({ last }: { last: ChartPoint }) {
  const px = last.c;
  const sma = last.sma20;
  const lo = last.lower;
  const hi = last.upper;
  const mid = last.mid ?? (lo != null && hi != null ? (lo + hi) / 2 : null);

  const smaBelow = sma != null && px < sma * 0.9965;
  const smaAbove = sma != null && px > sma * 1.0035;
  const smaGap = sma ? (Math.abs(px - sma) / px) * 100 : 0;
  const bbPos =
    lo != null && hi != null && hi > lo ? Math.max(0, Math.min(1, (px - lo) / (hi - lo))) : 0.5;
  const bbZone = bbPos <= 0.33 ? "low" : bbPos >= 0.67 ? "high" : "mid";
  const toMid = mid ? (Math.abs(mid - px) / px) * 100 : 0;

  return (
    <div className="border border-line bg-raised p-2">
      <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">Cómo leerlo · 2 reglas</p>
      <p className="mt-0.5 text-[11px] text-muted">
        <b className="text-fg">1.</b> Medias: encima ={" "}
        <span className="text-up">bueno</span>, debajo = <span className="text-down">malo</span>.{" "}
        <b className="text-fg">2.</b> Bollinger: el medio = <span className="text-up">bueno</span>,
        pegado a una banda = <span className="text-down">malo</span>.
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="border border-line bg-surface p-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold">SMA 20 · tendencia corta</p>
            <p
              className={cn(
                "text-[10px] font-semibold",
                smaBelow ? "text-down" : smaAbove ? "text-up" : "text-wait",
              )}
            >
              {smaBelow ? "MALO" : smaAbove ? "BUENO" : "EN LA META"}
            </p>
          </div>
          <div className="mt-1.5 grid grid-cols-2">
            <Zone
              title="MALO"
              sub="precio debajo"
              active={smaBelow}
              tone="down"
              mark={smaBelow ? `AQUÍ ${formatMoney(px)}` : undefined}
            />
            <Zone
              title="BUENO"
              sub="precio encima"
              active={smaAbove || (!smaBelow && sma != null)}
              tone="up"
              mark={smaAbove ? `AQUÍ ${formatMoney(px)}` : !smaBelow && sma ? `AQUÍ ${formatMoney(px)}` : undefined}
            />
          </div>
          {sma != null ? (
            <p className="mt-1.5 text-[11px] leading-snug">
              {smaBelow ? (
                <>
                  Estás en <span className="text-down">malo</span>. Bueno empieza en{" "}
                  <b>{formatMoney(sma)}</b>. Hay que <b>subir {smaGap.toFixed(1)}%</b> (
                  {formatMoney(sma - px)}).
                </>
              ) : smaAbove ? (
                <>
                  Estás en <span className="text-up">bueno</span>: {smaGap.toFixed(1)}% sobre{" "}
                  <b>{formatMoney(sma)}</b>. Si cae esa media, pasa a malo.
                </>
              ) : (
                <>
                  Pegado a la meta <b>{formatMoney(sma)}</b>. Un alza = bueno; una baja = malo.
                </>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">Sin SMA 20 todavía.</p>
          )}
        </div>

        <div className="border border-line bg-surface p-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold">Bollinger · volatilidad</p>
            <p
              className={cn(
                "text-[10px] font-semibold",
                bbZone === "mid" ? "text-up" : "text-down",
              )}
            >
              {bbZone === "mid" ? "BUENO" : "MALO"}
            </p>
          </div>
          <div className="mt-1.5 grid grid-cols-3">
            <Zone
              title="MALO"
              sub="banda inf."
              active={bbZone === "low"}
              tone="down"
              mark={bbZone === "low" ? `AQUÍ ${formatMoney(px)}` : undefined}
            />
            <Zone
              title="BUENO"
              sub="zona media"
              active={bbZone === "mid"}
              tone="up"
              mark={bbZone === "mid" ? `AQUÍ ${formatMoney(px)}` : undefined}
            />
            <Zone
              title="MALO"
              sub="banda sup."
              active={bbZone === "high"}
              tone="down"
              mark={bbZone === "high" ? `AQUÍ ${formatMoney(px)}` : undefined}
            />
          </div>
          {mid != null && lo != null && hi != null ? (
            <p className="mt-1.5 text-[11px] leading-snug">
              {bbZone === "low" && (
                <>
                  Estirado abajo. Bueno = volver a <b>{formatMoney(mid)}</b>. Faltan{" "}
                  <b>{toMid.toFixed(1)}% al alza</b>.
                </>
              )}
              {bbZone === "high" && (
                <>
                  Estirado arriba. Bueno = volver a <b>{formatMoney(mid)}</b>. Faltan{" "}
                  <b>{toMid.toFixed(1)}% a la baja</b>.
                </>
              )}
              {bbZone === "mid" && (
                <>
                  En el centro del canal (bueno). Media {formatMoney(mid)} · bandas{" "}
                  {formatMoney(lo)}–{formatMoney(hi)}.
                </>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted">Sin bandas todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Zone({
  title,
  sub,
  active,
  tone,
  mark,
}: {
  title: string;
  sub: string;
  active: boolean;
  tone: "up" | "down";
  mark?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-col items-center justify-center border px-1 py-1 text-center",
        tone === "up" ? "border-up/40" : "border-down/40",
        active && tone === "up" && "bg-up/20",
        active && tone === "down" && "bg-down/20",
        !active && "bg-bg/50 opacity-50",
      )}
    >
      <p className={cn("text-[10px] font-semibold", tone === "up" ? "text-up" : "text-down")}>{title}</p>
      <p className="text-[8px] text-muted">{sub}</p>
      {mark && <p className="mt-0.5 text-[9px] font-semibold text-fg">{mark}</p>}
    </div>
  );
}
