import type { PublicAnalysis } from "@/lib/market.fns";
import type { EquityEstimate, EquityHit } from "@/lib/equity";
import { cn, formatMoney, formatPct } from "@/lib/utils";

export function EquityTicket({
  hit,
  estimate,
  analysis,
}: {
  hit: EquityHit;
  estimate: EquityEstimate;
  analysis: PublicAnalysis | null;
}) {
  return (
    <section className="border border-line bg-surface lg:hidden">
      <div className="flex items-start justify-between gap-2 px-2 py-1.5">
        <div>
          <p className="font-semibold leading-none">{hit.s}</p>
          <p className="mt-0.5 text-[10px] text-muted">
            {formatMoney(analysis?.price ?? hit.px)} · {formatPct(analysis?.changePct ?? hit.changePct)} ·{" "}
            {hit.kind.toUpperCase()}
          </p>
        </div>
        <p className="text-right font-mono text-sm tabular-nums">
          {Math.round(analysis?.verdict.score ?? hit.score)}
          <span className="ml-1 text-[9px] text-subtle">SCORE</span>
        </p>
      </div>
      <div className="grid grid-cols-4 gap-px border-t border-line bg-line">
        <Stat k="Capital" v={formatMoney(estimate.capital)} />
        <Stat k="Acciones" v={String(estimate.shares)} />
        <Stat
          k="VE"
          v={`${estimate.expectedPnl >= 0 ? "+" : ""}${formatMoney(estimate.expectedPnl)}`}
          tone={estimate.expectedPnl >= 0 ? "up" : "down"}
        />
        <Stat
          k="Quedan"
          v={formatMoney(estimate.queda)}
          tone={estimate.queda >= estimate.capital ? "up" : "down"}
        />
        <Stat k="RSI" v={hit.rsi != null ? hit.rsi.toFixed(0) : "—"} />
        <Stat k="HV" v={`${(estimate.hv * 100).toFixed(0)}%`} />
        <Stat k="Rango ±" v={`${estimate.expectedMovePct.toFixed(1)}%`} />
        <Stat k="P(sube)" v={`${(estimate.pUp * 100).toFixed(0)}%`} />
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
