import type { Estimate } from "@/lib/estimate";
import type { PublicAnalysis } from "@/lib/market.fns";
import type { Ranked } from "@/lib/scan";
import { cn, formatMoney, formatPct } from "@/lib/utils";

export function OptionTicket({
  contract,
  estimate,
  analysis,
  dte,
  action,
}: {
  contract: Ranked;
  estimate: Estimate;
  analysis: PublicAnalysis | null;
  dte: number;
  action?: string;
}) {
  const spot = analysis?.price ?? contract.px;
  const ve = estimate.expectedPnl;
  const queda = estimate.capital + ve;

  return (
    <section className="border border-line bg-surface lg:hidden">
      <div className="flex items-start justify-between gap-2 px-2 py-1.5">
        <div>
          <p className="font-semibold leading-none">
            {contract.s}{" "}
            <span className={contract.t === "call" ? "text-up" : "text-down"}>
              {contract.k}
              {contract.t === "call" ? "C" : "P"}
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            {formatMoney(spot)}
            {analysis ? ` · ${formatPct(analysis.changePct)}` : ""}
            {contract.source === "live" ? " · LIVE" : ""}
            {action ? ` · ${action}` : ""}
          </p>
        </div>
        <p className="text-right font-mono text-sm tabular-nums">
          {Math.round(analysis?.verdict.score ?? contract.score)}
          <span className="ml-1 text-[9px] text-subtle">SCORE</span>
        </p>
      </div>

      <div className="grid grid-cols-4 gap-px border-t border-line bg-line">
        <Stat k="Prima" v={formatMoney(estimate.capital)} />
        <Stat
          k="Si tesis"
          v={`${estimate.targetPnl >= 0 ? "+" : ""}${formatMoney(estimate.targetPnl)}`}
          tone={estimate.targetPnl >= 0 ? "up" : "down"}
        />
        <Stat k="Promedio" v={`${ve >= 0 ? "+" : ""}${formatMoney(ve)}`} tone={ve >= 0 ? "up" : "down"} />
        <Stat k="Quedan*" v={formatMoney(queda)} tone={queda >= estimate.capital ? "up" : "down"} />
        <Stat k="Mid" v={formatMoney(contract.mid)} />
        <Stat k="DTE" v={String(dte)} />
        <Stat k="BE" v={formatMoney(estimate.breakeven)} />
        <Stat k="P(ganar)" v={`${(estimate.pProfit * 100).toFixed(0)}%`} />
        <Stat k="Spread" v={formatMoney(contract.spread)} />
        <Stat k="Vol" v={contract.vol.toLocaleString("en-US")} />
        <Stat k="OI" v={contract.oi.toLocaleString("en-US")} />
        <Stat k="HV" v={`${(estimate.hv * 100).toFixed(0)}%`} />
        {analysis?.indicators.rsi14 != null && (
          <Stat k="RSI" v={analysis.indicators.rsi14.toFixed(0)} />
        )}
        {analysis?.indicators.sma20 != null && (
          <Stat k="SMA20" v={formatMoney(analysis.indicators.sma20)} />
        )}
        <Stat k="Ctratos" v={String(estimate.contracts)} />
        <Stat k="Máx. pérdida" v={formatMoney(estimate.maxLoss)} tone="down" />
      </div>
    </section>
  );
}

function Stat({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="bg-surface px-1.5 py-1">
      <p className="text-[8px] tracking-[0.08em] text-subtle uppercase">{k}</p>
      <p
        className={cn(
          "truncate font-mono text-[11px] tabular-nums",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
        )}
      >
        {v}
      </p>
    </div>
  );
}
