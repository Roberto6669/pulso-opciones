import type { PublicAnalysis } from "@/lib/market.fns";
import { ScoreDial } from "@/components/score-dial";
import { cn, formatMoney } from "@/lib/utils";

const LABELS = {
  comprar: "Comprar",
  esperar: "Esperar",
  vender: "Vender",
} as const;

export function SignalPanel({ analysis }: { analysis: PublicAnalysis }) {
  const { verdict, indicators } = analysis;
  const tone =
    verdict.kind === "comprar"
      ? "text-up"
      : verdict.kind === "vender"
        ? "text-down"
        : "text-wait";

  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <ScoreDial score={verdict.score} label="Técnico" />
        <div>
          <p className="text-[10px] tracking-[0.16em] text-subtle uppercase">Señal</p>
          <h2 className={cn("font-display text-4xl leading-none tracking-tight", tone)}>
            {LABELS[verdict.kind]}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">{verdict.headline}</p>
        </div>
      </div>

      <ul className="mt-6 grid gap-0 sm:grid-cols-2">
        {verdict.reasons.map((reason) => (
          <li key={reason.title} className="border-t border-line py-3 pr-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{reason.title}</p>
              <span
                className={cn(
                  "font-mono text-xs tabular-nums",
                  reason.weight > 0 ? "text-up" : reason.weight < 0 ? "text-down" : "text-subtle",
                )}
              >
                {reason.weight > 0 ? "+" : ""}
                {reason.weight}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{reason.detail}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
        <Stat label="RSI 14" value={fmt(indicators.rsi14, 1)} />
        <Stat label="SMA 20" value={money(indicators.sma20)} />
        <Stat label="SMA 50" value={money(indicators.sma50)} />
        <Stat label="SMA 200" value={money(indicators.sma200)} />
        <Stat label="MACD hist" value={fmt(indicators.macdHist, 2)} />
        <Stat
          label="Bollinger"
          value={
            indicators.bbLower && indicators.bbUpper
              ? `${formatMoney(indicators.bbLower)}–${formatMoney(indicators.bbUpper)}`
              : "—"
          }
        />
      </dl>
    </section>
  );
}

function fmt(v: number | null, digits = 2) {
  if (v == null) return "—";
  return v.toFixed(digits);
}

function money(v: number | null) {
  if (v == null) return "—";
  return formatMoney(v);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-raised px-3 py-2">
      <dt className="text-[10px] tracking-wide text-subtle uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}
