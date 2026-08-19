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

export function actionFor(estimate: Estimate, analysis: PublicAnalysis | null) {
  if (estimate.contracts < 1) {
    return { label: "NO COMPRAR", tone: "down" as const, detail: "El presupuesto no cubre un contrato entero." };
  }
  if (estimate.expectedPnl <= 0 || estimate.pProfit < 0.28) {
    return {
      label: "VIGILAR",
      tone: "wait" as const,
      detail: "El valor esperado es débil o la probabilidad de ganar es baja.",
    };
  }
  if (analysis?.verdict.kind === "vender") {
    return { label: "VIGILAR", tone: "wait" as const, detail: "El técnico no acompaña esta dirección." };
  }
  return { label: "ANALIZAR", tone: "up" as const, detail: "Pasa el filtro mínimo de liquidez y valor esperado." };
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
    text: `La tesis es ${side}. En ${Math.max(days, 1)} DTE el movimiento típico (vol ${(estimate.hv * 100).toFixed(0)}%) apunta cerca de ${target.toFixed(2)}. Con ${estimate.contracts} contrato(s) inviertes ${estimate.capital.toFixed(2)}; el valor esperado no es una promesa, es el promedio del modelo. Si se pierde el nivel ${inv.toFixed(2)}, la tesis pierde calidad.`,
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
