import { useMemo } from "react";
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import type { Estimate } from "@/lib/estimate";
import { bsPrice } from "@/lib/estimate";
import type { PublicAnalysis } from "@/lib/market.fns";
import type { Ranked } from "@/lib/scan";
import { cn, formatMoney } from "@/lib/utils";

export function PlainWhy({
  contract,
  estimate,
  analysis,
  days,
  action,
}: {
  contract: Ranked;
  estimate: Estimate;
  analysis: PublicAnalysis | null;
  days: number;
  action: { label: string; tone: "up" | "wait" | "down"; stock?: string; detail: string };
}) {
  const name = contract.s;
  const spot = analysis?.price ?? contract.px;
  const be = estimate.breakeven;
  const call = contract.t === "call";
  const gap = Math.abs(be - spot);
  const gapPct = spot ? (gap / spot) * 100 : 0;
  const stockOk = analysis?.verdict.kind === "comprar" || (analysis?.verdict.score ?? 0) >= 65;
  const stockTxt =
    analysis?.verdict.kind === "vender" ? "Va mal" : stockOk ? "Va bien" : "Ni fu ni fa";
  const stockTone =
    analysis?.verdict.kind === "vender" ? "down" : stockOk ? "up" : "wait";
  const take = action.tone === "up" ? "Puede servir" : action.tone === "wait" ? "Mejor espera" : "No lo compres";
  const sigma = estimate.ivUsed ?? estimate.hv ?? 0.25;

  const path = useMemo(() => {
    const series = analysis?.series?.filter((p) => Number.isFinite(p.c)) ?? [];
    const slice = series.slice(-22);
    if (slice.length < 3) return [];
    return slice.map((p, i) => {
      const left = Math.max(0, days + (slice.length - 1 - i));
      const opt = bsPrice(p.c, contract.k, left / 365, sigma, contract.t) * 100;
      return { t: p.t, px: p.c, opt, win: call ? p.c >= be : p.c <= be };
    });
  }, [analysis?.series, be, call, contract.k, contract.t, days, sigma]);

  const firstOpt = path[0]?.opt;
  const lastOpt = path.at(-1)?.opt ?? estimate.capital;
  const optUp = firstOpt != null && lastOpt >= firstOpt;
  const optChg = firstOpt ? lastOpt - firstOpt : 0;
  const pxMin = path.length ? Math.min(...path.map((p) => p.px), be, contract.k) : spot;
  const pxMax = path.length ? Math.max(...path.map((p) => p.px), be, contract.k) : be;
  const padPx = (pxMax - pxMin) * 0.06 || 1;

  return (
    <div>
      <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">¿Compro esto?</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <div className="border border-line px-1.5 py-1">
          <p className="text-[8px] text-subtle uppercase">La acción {name}</p>
          <p
            className={cn(
              "text-[13px] font-semibold",
              stockTone === "up" && "text-up",
              stockTone === "down" && "text-down",
              stockTone === "wait" && "text-wait",
            )}
          >
            {stockTxt}
          </p>
        </div>
        <div className="border border-line px-1.5 py-1">
          <p className="text-[8px] text-subtle uppercase">Tu boleto</p>
          <p
            className={cn(
              "text-[13px] font-semibold",
              action.tone === "up" && "text-up",
              action.tone === "wait" && "text-wait",
              action.tone === "down" && "text-down",
            )}
          >
            {take}
          </p>
        </div>
      </div>

      {path.length > 0 && (
        <div className="mt-3 space-y-2">
          <div>
            <div className="mb-0.5 flex items-baseline justify-between">
              <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">Qué tiene que hacer para ganar</p>
              <p className="text-[9px] text-muted">
                {call ? "Tiene que subir y cruzar la raya verde" : "Tiene que bajar y cruzar la raya verde"}
              </p>
            </div>
            <div className="h-28 bg-bg/60">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={path} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <YAxis
                    domain={[pxMin - padPx, pxMax + padPx]}
                    width={48}
                    tick={{ fill: "var(--color-subtle)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => Number(v).toFixed(0)}
                  />
                  <ReferenceLine
                    y={be}
                    stroke="var(--color-up)"
                    strokeDasharray="4 3"
                    label={{ value: "Ganas", fill: "var(--color-up)", fontSize: 9, position: "insideTopRight" }}
                  />
                  <ReferenceLine y={contract.k} stroke="var(--color-subtle)" strokeDasharray="2 3" />
                  <Area type="monotone" dataKey="px" stroke="var(--color-fg)" fill="var(--color-accent)" fillOpacity={0.08} strokeWidth={1.6} />
                  <Line type="monotone" dataKey="px" stroke="var(--color-fg)" strokeWidth={1.6} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-0.5 text-[9px] text-muted">
              Línea blanca = {name} estas semanas. Raya verde = {formatMoney(be)} (si cierra allá, ganas). Punteado gris = el número del boleto ({formatMoney(contract.k)}).
            </p>
          </div>

          <div>
            <div className="mb-0.5 flex items-baseline justify-between">
              <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">Cómo venía el boleto</p>
              <p className={cn("text-[9px]", optUp ? "text-up" : "text-down")}>
                {optUp ? "Venía subiendo" : "Venía bajando"} · {firstOpt != null ? formatMoney(firstOpt) : "—"} → {formatMoney(lastOpt)}
              </p>
            </div>
            <div className="h-20 bg-bg/60">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={path} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <YAxis
                    domain={["dataMin - 1", "dataMax + 1"]}
                    width={48}
                    tick={{ fill: "var(--color-subtle)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => Number(v).toFixed(0)}
                  />
                  <Area
                    type="monotone"
                    dataKey="opt"
                    stroke={optUp ? "var(--color-up)" : "var(--color-down)"}
                    fill={optUp ? "var(--color-up)" : "var(--color-down)"}
                    fillOpacity={0.18}
                    strokeWidth={1.5}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-0.5 text-[9px] text-muted">
              Esto es cuánto habría costado el mismo boleto cada día. Hoy está en {formatMoney(estimate.capital)}.
              {optChg !== 0 && (
                <>
                  {" "}
                  En estas semanas {optUp ? "subió" : "bajó"} {formatMoney(Math.abs(optChg))}.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1 text-[12px] leading-snug text-fg">
        <p>
          {name} hoy vale <b>{formatMoney(spot)}</b>. Para ganar tiene que {call ? "subir" : "bajar"} a{" "}
          <b>{formatMoney(be)}</b> ({gapPct.toFixed(1)}%, {formatMoney(gap)}) en{" "}
          <b>
            {days} {days === 1 ? "día" : "días"}
          </b>
          .
        </p>
        {action.tone === "down" && (
          <p className="text-down">
            Mira la raya verde: está lejos para tan poco reloj. Si no llega, pierdes los {formatMoney(estimate.capital)}.
          </p>
        )}
        {action.tone === "wait" && (
          <p className="text-wait">El salto hasta la raya verde todavía es grande para el tiempo que queda.</p>
        )}
        {action.tone === "up" && (
          <p className="text-up">
            La raya verde está más cerca. Igual puedes perder los {formatMoney(estimate.capital)}.
          </p>
        )}
      </div>
    </div>
  );
}
