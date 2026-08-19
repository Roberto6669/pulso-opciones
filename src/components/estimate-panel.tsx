import type { Estimate } from "@/lib/estimate";
import type { PublicAnalysis } from "@/lib/market.fns";
import type { Ranked } from "@/lib/scan";
import { thesis } from "@/lib/setup";
import { cn, formatMoney } from "@/lib/utils";

export function EstimatePanel({
  estimate,
  dte,
  contract,
  analysis,
}: {
  estimate: Estimate;
  dte: number;
  contract: Ranked;
  analysis: PublicAnalysis | null;
}) {
  const story = thesis(contract, analysis, estimate, dte);
  const queda = estimate.capital + estimate.expectedPnl;
  const past = estimate.lastWindow;
  const quedaAntes = estimate.capital + (past?.pnl ?? 0);
  const atTarget = estimate.scenarios.find((s) => s.id === "exp");
  const objetivoPnl = atTarget?.pnl ?? estimate.featured.pnl;
  const objetivoTotal = estimate.capital + objetivoPnl;

  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Análisis futuro</p>
          <h3 className="text-sm font-semibold">Ruta {story.side} de referencia</h3>
        </div>
        <p className="text-[10px] text-muted">{Math.max(dte, 1)} DTE</p>
      </div>

      <p className="border-b border-line px-3 py-2 text-[11px] text-muted">{story.text}</p>

      <div className="grid gap-px bg-line sm:grid-cols-3">
        <Cell
          label="Objetivo orientativo"
          value={formatMoney(story.target)}
          hint={`Desde el spot: ${analysis ? (((story.target / analysis.price) - 1) * 100).toFixed(1) : "—"}%`}
        />
        <Cell
          label="Nivel de invalidación"
          value={formatMoney(story.invalidation)}
          hint="Si se supera, la tesis pierde calidad"
        />
        <Cell
          label="Zona de ganancia al vencimiento"
          value={`≥ ${formatMoney(estimate.breakeven)}`}
          hint={`${contract.t.toUpperCase()} debe cruzar el break-even`}
        />
        <Cell
          label="Dinero realmente invertido"
          value={formatMoney(estimate.capital)}
          hint={`${estimate.contracts} contrato(s) · ${formatMoney(estimate.debitEach)} c/u`}
        />
        <Cell
          label="Ganancia / pérdida estimada"
          value={`${estimate.expectedPnl >= 0 ? "+" : ""}${formatMoney(estimate.expectedPnl)}`}
          hint={`${estimate.expectedPnlPct >= 0 ? "+" : ""}${estimate.expectedPnlPct.toFixed(1)}% · P(ganar) ${(estimate.pProfit * 100).toFixed(0)}%`}
          tone={estimate.expectedPnl >= 0 ? "up" : "down"}
        />
        <Cell label="Qué vigilar" value="Soporte + volumen" hint={story.watch} />
      </div>

      <div className="grid gap-px bg-line p-px sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <FormulaBox label="Capital disponible" value={formatMoney(estimate.capital)} hint="Lo que pagas ahora (prima × 100 × contratos)" />
        <Op>+</Op>
        <FormulaBox
          label="Valor esperado"
          value={`${estimate.expectedPnl >= 0 ? "+" : ""}${formatMoney(estimate.expectedPnl)}`}
          hint={`Black-Scholes: teórico ${formatMoney(estimate.fair * 100 * estimate.contracts)} − prima ${formatMoney(estimate.capital)}`}
          tone={estimate.expectedPnl >= 0 ? "up" : "down"}
        />
        <Op>=</Op>
        <FormulaBox
          label="Te quedarían (promedio)"
          value={formatMoney(queda)}
          hint={`Vol. hist. ${(estimate.hv * 100).toFixed(0)}% · ${Math.max(dte, 1)} DTE · no es el caso si llega al objetivo`}
          tone={queda >= estimate.capital ? "up" : "down"}
        />
      </div>

      <p className="px-3 py-1.5 text-[10px] text-subtle">
        El recuadro del medio no es “si ganas”. Es el promedio del modelo: compara lo que pagas con lo que Black-Scholes dice que vale la opción usando la volatilidad de los últimos meses, no la máxima si el precio llega al objetivo. Si el spot llega a {formatMoney(story.target)}, el resultado al vencimiento sería {objetivoPnl >= 0 ? "+" : ""}
        {formatMoney(objetivoPnl)} y te quedarían {formatMoney(objetivoTotal)}.
      </p>

      <div className="border-t border-line px-3 py-2">
        <p className="mb-1.5 text-[9px] tracking-[0.14em] text-subtle uppercase">
          Resultado histórico · hace {Math.max(dte, 1)} días
        </p>
        {past ? (
          <div className="grid gap-2 sm:grid-cols-4">
            <Mini label="Entrada" value={formatMoney(past.entry * 100)} />
            <Mini label="Salida" value={formatMoney(past.exit * 100)} />
            <Mini
              label="Ganas / Pierdes"
              value={`${past.pnl >= 0 ? "+" : ""}${formatMoney(past.pnl)}`}
              tone={past.pnl >= 0 ? "up" : "down"}
            />
            <Mini
              label="Te habrían quedado"
              value={formatMoney(quedaAntes)}
              tone={quedaAntes >= estimate.capital ? "up" : "down"}
            />
          </div>
        ) : (
          <p className="text-[11px] text-muted">Sin ventana histórica comparable.</p>
        )}
        <p className="mt-1.5 text-[10px] text-subtle">
          Win rate {estimate.backtest.trades ? `${(estimate.backtest.winRate * 100).toFixed(0)}%` : "—"} en{" "}
          {estimate.backtest.trades} ventanas del mismo DTE.
        </p>
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="bg-surface px-3 py-2">
      <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm tabular-nums", tone === "up" && "text-up", tone === "down" && "text-down")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
    </div>
  );
}

function FormulaBox({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down";
}) {
  return (
    <div
      className={cn(
        "bg-raised px-3 py-2",
        tone === "up" && "outline outline-1 outline-up/40",
        tone === "down" && "outline outline-1 outline-down/40",
      )}
    >
      <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm tabular-nums", tone === "up" && "text-up", tone === "down" && "text-down")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-muted">{hint}</p>
    </div>
  );
}

function Op({ children }: { children: string }) {
  return <div className="grid place-items-center bg-surface px-2 font-mono text-lg text-subtle">{children}</div>;
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="bg-raised px-2 py-1.5">
      <p className="text-[9px] text-subtle">{label}</p>
      <p className={cn("font-mono text-xs tabular-nums", tone === "up" && "text-up", tone === "down" && "text-down")}>
        {value}
      </p>
    </div>
  );
}
