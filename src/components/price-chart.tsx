import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
};

type Overlay = "bb" | "sma20" | "sma50" | "sma200";
type Range = "1m" | "3m" | "6m";

const OVERLAYS: { id: Overlay; label: string; swatch: string }[] = [
  { id: "bb", label: "Bollinger", swatch: "bg-bb" },
  { id: "sma20", label: "SMA 20", swatch: "bg-sma20" },
  { id: "sma50", label: "SMA 50", swatch: "bg-sma50" },
  { id: "sma200", label: "SMA 200", swatch: "bg-sma200" },
];

const RANGES: { id: Range; label: string; bars: number }[] = [
  { id: "1m", label: "1M", bars: 22 },
  { id: "3m", label: "3M", bars: 66 },
  { id: "6m", label: "6M", bars: 130 },
];

function axisTick(v: number) {
  return format(v, "d MMM", { locale: es });
}

function Candle(props: {
  x?: number;
  width?: number;
  payload?: ChartPoint;
  background?: { y: number; height: number };
  yMin: number;
  yMax: number;
}) {
  const p = props.payload;
  const bg = props.background;
  const x = props.x ?? 0;
  const width = props.width ?? 4;
  if (!p || !bg) return null;
  const o = p.o ?? p.c;
  const h = p.h ?? p.c;
  const l = p.l ?? p.c;
  const span = props.yMax - props.yMin || 1;
  const scale = (v: number) => bg.y + ((props.yMax - v) / span) * bg.height;
  const up = p.c >= o;
  const color = up ? "var(--color-up)" : "var(--color-down)";
  const cx = x + width / 2;
  const bw = Math.max(width * 0.62, 2);
  const yO = scale(o);
  const yC = scale(p.c);
  return (
    <g>
      <line x1={cx} y1={scale(h)} x2={cx} y2={scale(l)} stroke={color} strokeWidth={1.2} />
      <rect
        x={cx - bw / 2}
        y={Math.min(yO, yC)}
        width={bw}
        height={Math.max(Math.abs(yC - yO), 1.2)}
        fill={color}
      />
    </g>
  );
}

export function PriceChart({
  series,
  currency,
  target,
}: {
  series: ChartPoint[];
  currency: string;
  target?: { price: number; label: string } | null;
}) {
  const [on, setOn] = useState<Record<Overlay, boolean>>({
    bb: true,
    sma20: true,
    sma50: true,
    sma200: false,
  });
  const [range, setRange] = useState<Range>("3m");

  const data = useMemo(() => {
    const ready = series.filter((p) => Number.isFinite(p.c));
    const n = RANGES.find((r) => r.id === range)?.bars ?? 66;
    return ready.slice(-n);
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
    const pad = (max - min) * 0.06 || 1;
    return {
      yMin: min - pad,
      yMax: max + pad,
      last: data.at(-1),
    };
  }, [data, on.bb, target?.price]);

  const tipStyle = {
    background: "var(--color-raised)",
    border: "1px solid var(--color-line)",
    borderRadius: 0,
    color: "var(--color-fg)",
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex flex-wrap gap-1">
          {OVERLAYS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOn((s) => ({ ...s, [item.id]: !s[item.id] }))}
              className={cn(
                "inline-flex h-6 items-center gap-1 border px-1.5 text-[10px]",
                on[item.id] ? "border-line-strong bg-raised text-fg" : "border-line text-subtle",
              )}
            >
              <span className={cn("size-1.5 rounded-full", item.swatch)} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-bg/70 p-1.5">
        <div className="mb-0.5 flex items-baseline justify-between px-1">
          <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">Precio · Velas</p>
          {last && (
            <p className="font-mono text-xs tabular-nums">
              {formatMoney(last.c, currency)}{" "}
              <span className={last.up ? "text-up" : "text-down"}>
                {last.up ? "+" : ""}
              </span>
            </p>
          )}
        </div>
        <div className="h-56 w-full sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} strokeOpacity={0.7} />
              <XAxis dataKey="t" hide />
              <YAxis
                yAxisId="price"
                orientation="right"
                domain={[yMin, yMax]}
                width={56}
                tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  Number(v).toLocaleString("es-US", { maximumFractionDigits: 0 })
                }
              />
              <YAxis yAxisId="vol" hide domain={[0, (dataMax: number) => dataMax * 3.6]} />
              {target && (
                <ReferenceLine
                  yAxisId="price"
                  y={target.price}
                  stroke="var(--color-fg)"
                  strokeDasharray="5 4"
                  label={{
                    value: target.label,
                    fill: "var(--color-fg)",
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
                  return [Number.isFinite(n) ? formatMoney(n, currency) : "—", labels[String(name)] ?? String(name)];
                }}
              />
              <Bar yAxisId="vol" dataKey="v" maxBarSize={8}>
                {data.map((p) => (
                  <Cell
                    key={`v-${p.t}`}
                    fill={p.up ? "var(--color-up)" : "var(--color-down)"}
                    fillOpacity={0.28}
                  />
                ))}
              </Bar>
              {on.bb && (
                <Line yAxisId="price" type="monotone" dataKey="upper" stroke="var(--color-bb)" strokeWidth={1} dot={false} strokeDasharray="4 3" />
              )}
              {on.bb && (
                <Line yAxisId="price" type="monotone" dataKey="lower" stroke="var(--color-bb)" strokeWidth={1} dot={false} strokeDasharray="4 3" />
              )}
              {on.sma20 && (
                <Line yAxisId="price" type="monotone" dataKey="sma20" stroke="var(--color-sma20)" strokeWidth={1.4} dot={false} />
              )}
              {on.sma50 && (
                <Line yAxisId="price" type="monotone" dataKey="sma50" stroke="var(--color-sma50)" strokeWidth={1.5} dot={false} />
              )}
              {on.sma200 && (
                <Line yAxisId="price" type="monotone" dataKey="sma200" stroke="var(--color-sma200)" strokeWidth={1.4} dot={false} />
              )}
              <Bar
                yAxisId="price"
                dataKey="h"
                isAnimationActive={false}
                shape={(props: any) => <Candle {...props} yMin={yMin} yMax={yMax} />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 px-1 text-[9px] tracking-[0.12em] text-subtle uppercase">
          RSI 14{last?.rsi != null ? ` · ${last.rsi.toFixed(1)}` : ""}
        </p>
        <div className="h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rsiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-up)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-up)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis
                domain={[0, 100]}
                orientation="right"
                width={56}
                ticks={[30, 70]}
                tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <XAxis dataKey="t" hide />
              <ReferenceLine y={70} stroke="var(--color-down)" strokeDasharray="3 3" strokeOpacity={0.7} />
              <ReferenceLine y={30} stroke="var(--color-up)" strokeDasharray="3 3" strokeOpacity={0.7} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => [Number(v).toFixed(1), "RSI"]} />
              <Area type="monotone" dataKey="rsi" stroke="var(--color-up)" fill="url(#rsiFill)" strokeWidth={1.6} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 px-1 text-[9px] tracking-[0.12em] text-subtle uppercase">MACD</p>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="t"
                tickFormatter={axisTick}
                minTickGap={28}
                tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                orientation="right"
                width={56}
                tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
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
              <Bar dataKey="hist" maxBarSize={6}>
                {data.map((p) => (
                  <Cell
                    key={`h-${p.t}`}
                    fill={(p.hist ?? 0) >= 0 ? "var(--color-up)" : "var(--color-down)"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              <Line type="monotone" dataKey="macd" stroke="var(--color-macd)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="signal" stroke="var(--color-sma50)" strokeWidth={1.3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
