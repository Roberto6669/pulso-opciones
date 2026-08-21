import { PayoffChart } from "@/components/payoff-chart";
import type { Estimate } from "@/lib/estimate";
import { cn, formatMoney } from "@/lib/utils";

export function OptionsCalculator({
  estimate,
  spot,
  dte,
}: {
  estimate: Estimate;
  spot: number;
  dte: number;
}) {
  const emPct = estimate.expectedMovePct;
  const emAbs = spot * (emPct / 100);
  const emLow = Math.max(0, spot - emAbs);
  const emHigh = spot + emAbs;

  // Escenarios clave estilo calculadora (Moomoo-like)
  const order = ["flat", "m1", "p1", "m2", "p2", "exp"];
  const keyScenarios = order
    .map((id) => estimate.scenarios.find((s) => s.id === id))
    .filter(Boolean)
    .slice(0, 5) as typeof estimate.scenarios;

  return (
    <section className="border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Calculadora de opciones</p>
        <p className="font-mono text-[9px] text-muted">{Math.max(dte, 1)} DTE</p>
      </div>

      {/* Expected Move — destacado */}
      <div className="border-b border-line bg-raised/60 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">Expected Move (EM)</p>
          <p className="font-mono text-[10px] text-accent">1σ</p>
        </div>
        <p className="mt-0.5 font-mono text-sm tabular-nums text-accent">
          ±{emPct.toFixed(1)}%
        </p>
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-fg">
          {formatMoney(emLow)} – {formatMoney(emHigh)}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          σ {(estimate.sigma * 100).toFixed(0)}%
          {estimate.ivUsed ? ` · IV ${(estimate.ivUsed * 100).toFixed(0)}% + HV` : " · HV"} · rango típico en {Math.max(dte, 1)} días
        </p>
      </div>

      {/* Gráfica de payoff */}
      <div className="border-b border-line px-1 py-1.5">
        <p className="mb-1 px-1.5 text-[9px] tracking-[0.12em] text-subtle uppercase">P&L al vencimiento</p>
        <PayoffChart
          points={estimate.payoff}
          spot={spot}
          breakeven={estimate.breakeven}
          emLow={emLow}
          emHigh={emHigh}
        />
      </div>

      {/* Tabla de escenarios */}
      <div className="px-0">
        <p className="border-b border-line px-2.5 py-1 text-[9px] tracking-[0.12em] text-subtle uppercase">
          Si el precio llega a…
        </p>
        <div className="divide-y divide-line">
          {keyScenarios.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[10px] text-fg">{s.label.replace(/ \(.*\)/, "")}</p>
                <p className="font-mono text-[10px] text-muted tabular-nums">
                  {formatMoney(s.spot)} ({s.movePct >= 0 ? "+" : ""}
                  {s.movePct.toFixed(1)}%)
                </p>
              </div>
              <p
                className={cn(
                  "shrink-0 font-mono text-[11px] tabular-nums",
                  s.pnl > 0 && "text-up",
                  s.pnl < 0 && "text-down",
                  s.pnl === 0 && "text-muted",
                )}
              >
                {s.pnl >= 0 ? "+" : ""}
                {formatMoney(s.pnl)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
        <MiniStat label="Máx. pérdida" value={formatMoney(estimate.maxLoss)} tone="down" />
        <MiniStat label="Break-even" value={formatMoney(estimate.breakeven)} />
        <MiniStat
          label="P(ganar)"
          value={`${(estimate.pProfit * 100).toFixed(0)}%`}
          tone={estimate.pProfit >= 0.25 ? "up" : estimate.pProfit < 0.12 ? "down" : undefined}
        />
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="bg-surface px-2 py-1.5">
      <p className="text-[8px] tracking-[0.1em] text-subtle uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-[11px] tabular-nums",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
        )}
      >
        {value}
      </p>
    </div>
  );
}
