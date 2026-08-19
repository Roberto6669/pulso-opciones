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

export function actionFor(
  estimate: Estimate,
  analysis: PublicAnalysis | null,
  contract?: Ranked,
  days?: number,
) {
  const dte = Math.max(days ?? 1, 1);
  const spot = analysis?.price ?? contract?.px ?? 0;
  const stockKind = analysis?.verdict.kind;
  const stockGood = stockKind === "comprar" || (analysis?.verdict.score ?? 0) >= 65;
  const stockLabel =
    stockKind === "comprar" ? "BUENO" : stockKind === "vender" ? "EN CONTRA" : "NEUTRO";

  if (estimate.contracts < 1) {
    return {
      label: "NO",
      tone: "down" as const,
      stock: stockLabel,
      detail: "El presupuesto no cubre un contrato entero.",
    };
  }

  const need = estimate.breakeven - spot;
  const needPct = spot ? (need / spot) * 100 : 0;
  const gap =
    contract?.t === "put"
      ? `el precio debe caer a ${estimate.breakeven.toFixed(2)}`
      : `el precio debe subir a ${estimate.breakeven.toFixed(2)}`;

  const p = estimate.pProfit;
  const move = Math.max(estimate.expectedMovePct, 0.15);
  const needAbs = Math.abs(needPct);
  const reachable = needAbs <= move * 1.15;
  const stretch = needAbs > move * 2.1;
  const against =
    contract &&
    ((contract.t === "call" && stockKind === "vender") ||
      (contract.t === "put" && stockKind === "comprar"));

  if (stretch || p < 0.09) {
    return {
      label: "NO",
      tone: "down" as const,
      stock: stockLabel,
      detail: `Para ganar, ${gap} (${needAbs.toFixed(1)}%) en ${dte} día(s). Un día normal mueve ~${move.toFixed(1)}%. Queda demasiado lejos.`,
    };
  }
  if (against) {
    return {
      label: "MIRAR",
      tone: "wait" as const,
      stock: stockLabel,
      detail: "La acción va al lado contrario de este boleto.",
    };
  }
  if ((p >= 0.2 || reachable) && stockGood && (estimate.targetPnl > -estimate.capital * 0.35 || p >= 0.28)) {
    return {
      label: "SÍ",
      tone: "up" as const,
      stock: stockLabel,
      detail: `El salto (${needAbs.toFixed(1)}%) entra en lo que suele moverse (~${move.toFixed(1)}%) y la acción va a favor.`,
    };
  }
  if (p >= 0.12 || reachable) {
    return {
      label: "MIRAR",
      tone: "wait" as const,
      stock: stockLabel,
      detail: `No es locura: faltan ${needAbs.toFixed(1)}% y el movimiento típico es ~${move.toFixed(1)}%. Tampoco es un sí claro.`,
    };
  }
  return {
    label: "NO",
    tone: "down" as const,
    stock: stockLabel,
    detail: `Faltan ${needAbs.toFixed(1)}% en ${dte} día(s). Demasiado para este boleto.`,
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
