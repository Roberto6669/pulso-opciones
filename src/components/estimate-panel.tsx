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
  const objetivoPnl = estimate.targetPnl;
  const objetivoTotal = estimate.capital + objetivoPnl;

  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Cómo leer este contrato</p>
          <h3 className="text-sm font-semibold">
            Tesis {story.side} · {Math.max(dte, 1)} DTE
          </h3>
        </div>
        <p className="text-[10px] text-muted">
          Vol {(estimate.sigma * 100).toFixed(0)}%
          {estimate.ivUsed ? ` (IV ${(estimate.ivUsed * 100).toFixed(0)}% + HV)` : " HV"}
        </p>
      </div>

      <p className="border-b border-line px-3 py-2 text-[11px] text-muted">{story.text}</p>

      <div className="grid gap-px bg-line sm:grid-cols-3">
        <FormulaBox
          label="1. Invertiste"
          value={formatMoney(estimate.capital)}
          hint={`${estimate.contracts} contrato(s) · esto es lo máximo que puedes perder`}
        />
        <FormulaBox
          label="2. Si llega a la tesis"
          value={`${objetivoPnl >= 0 ? "+" : ""}${formatMoney(objetivoPnl)}`}
          hint={`Precio a ${formatMoney(story.target)} · te quedarían ${formatMoney(objetivoTotal)}`}
          tone={objetivoPnl >= 0 ? "up" : "down"}
        />
        <FormulaBox
          label="3. Promedio del modelo"
          value={`${estimate.expectedPnl >= 0 ? "+" : ""}${formatMoney(estimate.expectedPnl)}`}
          hint={`No es el caso 2. P(cruzar BE) ${(estimate.pProfit * 100).toFixed(0)}% · te quedarían ${formatMoney(queda)}`}
          tone={estimate.expectedPnl >= 0 ? "up" : "down"}
        />
      </div>

      <div className="grid gap-px bg-line sm:grid-cols-4">
        <Cell label="Break-even" value={formatMoney(estimate.breakeven)} hint="El subyacente debe cruzar esto" />
        <Cell
          label="Invalidación"
          value={formatMoney(story.invalidation)}
          hint="Si se pierde, la tesis se cae"
        />
        <Cell label="Qué vigilar" value="Soporte + vol." hint={story.watch} />
        <Cell
          label="Hace N días"
          value={past ? `${past.pnl >= 0 ? "+" : ""}${formatMoney(past.pnl)}` : "—"}
          hint={past ? `Te habrían quedado ${formatMoney(quedaAntes)}` : "Sin ventana comparable"}
          tone={past ? (past.pnl >= 0 ? "up" : "down") : undefined}
        />
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
