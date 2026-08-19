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
          {OVERLAYS.map((item) => {
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
      ? "linear-gradient(90deg,#d46565 0%,#c49a48 22%,#3cbc82 50%,#c49a48 78%,#d46565 100%)"
      : "linear-gradient(90deg,#d46565 0%,#c49a48 50%,#3cbc82 100%)";
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
