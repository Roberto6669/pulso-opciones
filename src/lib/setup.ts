import type { PublicAnalysis } from "@/lib/market.fns";
import type { Estimate } from "@/lib/estimate";
import type { Ranked } from "@/lib/scan";

export type Tag = { id: string; label: string };

export function setupTags(analysis: PublicAnalysis | null, contract: Ranked): Tag[] {
  const tags: Tag[] = [];
  if (!analysis) {
    tags.push({
      id: "side",
      label: contract.t === "call" ? "CALL" : "PUT",
    });
    return tags;
  }
  const p = analysis.price;
  const i = analysis.indicators;
  if (i.sma20 && p > i.sma20) tags.push({ id: "alcista", label: "ALCISTA" });
  else if (i.sma20 && p < i.sma20) tags.push({ id: "bajista", label: "BAJISTA" });
  if (i.bbLower && p <= i.bbLower * 1.015) tags.push({ id: "rebote", label: "REBOTE BANDA INFERIOR" });
  if (i.bbUpper && p >= i.bbUpper * 0.985) tags.push({ id: "techo", label: "TOQUE BANDA SUPERIOR" });
  if ((contract.t === "call" && analysis.verdict.kind === "comprar") || contract.trend === "up") {
    tags.push({ id: "sesgo", label: "SESGO ALCISTA FAVORABLE" });
  }
  if ((contract.t === "put" && analysis.verdict.kind === "vender") || contract.trend === "down") {
    tags.push({ id: "sesgo-b", label: "SESGO BAJISTA" });
  }
  return tags.slice(0, 4);
}

export function actionFor(estimate: Estimate, analysis: PublicAnalysis | null, contract?: Ranked) {
  if (estimate.contracts < 1) {
    return { label: "NO COMPRAR", tone: "down" as const, detail: "El presupuesto no cubre un contrato entero." };
  }
  if (estimate.pProfit < 0.16) {
    return {
      label: "EVITAR",
      tone: "down" as const,
      detail: "Poca probabilidad de cruzar el break-even antes del vencimiento.",
    };
  }
  const against =
    contract &&
    ((contract.t === "call" && analysis?.verdict.kind === "vender") ||
      (contract.t === "put" && analysis?.verdict.kind === "comprar"));
  if (against) {
    return { label: "VIGILAR", tone: "wait" as const, detail: "El técnico apunta al lado contrario." };
  }
  if (estimate.pProfit >= 0.3 && (estimate.targetPnl > 0 || estimate.expectedPnl > -estimate.capital * 0.15)) {
    return {
      label: "ANALIZAR",
      tone: "up" as const,
      detail: "Hay chance razonable de cruzar el BE y el técnico no lo contradice.",
    };
  }
  return {
    label: "VIGILAR",
    tone: "wait" as const,
    detail: "No es un no, pero el promedio del modelo no es fuerte.",
  };
}

export function confidenceLabel(score: number) {
  if (score >= 80) return "Confianza alta";
  if (score >= 65) return "Confianza media-alta";
  if (score >= 50) return "Confianza media";
  return "Confianza baja";
}

export function dteRisk(days: number) {
  if (days <= 7) return { label: "Agresivo", tone: "down" as const };
  if (days <= 21) return { label: "Aceptable", tone: "wait" as const };
  if (days <= 45) return { label: "Balanceado", tone: "up" as const };
  return { label: "Largo", tone: "wait" as const };
}

export function thesis(
  contract: Ranked,
  analysis: PublicAnalysis | null,
  estimate: Estimate,
  days: number,
) {
  const side = contract.t === "call" ? "alcista" : "bajista";
  const spot = analysis?.price ?? contract.px;
  const target = estimate.featured.spot;
  const inv =
    contract.t === "call"
      ? (analysis?.indicators.sma20 ?? spot * 0.97)
      : (analysis?.indicators.sma20 ?? spot * 1.03);
  return {
    side,
    text: `Tesis ${side}: si en ${Math.max(days, 1)} días el precio va hacia ${target.toFixed(2)}, el contrato gana o pierde según cruce ${estimate.breakeven.toFixed(2)}. “Promedio del modelo” no es esa ganancia: es lo que la prima vale hoy según la volatilidad.`,
    target,
    invalidation: inv,
    watch:
      contract.t === "call"
        ? "Soporte + volumen. Si pierde la media 20, no fuerces el call."
        : "Resistencia + volumen. Si recupera la media 20, no fuerces el put.",
  };
}

export function whyAppeared(contract: Ranked, analysis: PublicAnalysis | null) {
  const items: string[] = [];
  items.push(`Contrato ${contract.t.toUpperCase()} ${contract.k}: ${contract.why}.`);
  if (analysis) {
    for (const reason of analysis.verdict.reasons.slice(0, 4)) {
      items.push(`${reason.title}: ${reason.detail}`);
    }
  }
  return items;
}
