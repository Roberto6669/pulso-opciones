import { createServerFn } from "@tanstack/react-start";
import { chartSeries, computeIndicators, judge, sparkline, type SignalKind, type SparkPoint } from "./analysis";
import {
  fetchChart,
  fetchHotUnderlyings,
  fetchOptionChain,
  INDEX_SYMBOLS,
  RADAR_SYMBOLS,
  searchSymbols,
  type LiveOption,
} from "./yahoo.server";
import { dte, scoreContract, type Ranked, type Side, type Trend } from "./scan";
import { histVol } from "./estimate";
import type { EquityHit } from "./equity";

export type PublicAnalysis = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  weekHigh: number;
  weekLow: number;
  exchange: string;
  indicators: ReturnType<typeof computeIndicators>;
  verdict: ReturnType<typeof judge>;
  series: ReturnType<typeof chartSeries>;
};

function analyzeBundle(bundle: Awaited<ReturnType<typeof fetchChart>>): PublicAnalysis {
  const ind = computeIndicators(bundle.bars);
  return {
    symbol: bundle.meta.symbol,
    name: bundle.meta.name,
    currency: bundle.meta.currency,
    price: bundle.meta.price,
    change: bundle.meta.change,
    changePct: bundle.meta.changePct,
    dayHigh: bundle.meta.dayHigh,
    dayLow: bundle.meta.dayLow,
    weekHigh: bundle.meta.weekHigh,
    weekLow: bundle.meta.weekLow,
    exchange: bundle.meta.exchange,
    indicators: ind,
    verdict: judge(bundle.meta.price, bundle.bars, ind),
    series: chartSeries(bundle.bars),
  };
}

export const analyzeTicker = createServerFn({ method: "POST" })
  .validator((input: { symbol: string; range?: string }) => ({
    symbol: String(input.symbol ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9.^=-]/g, "")
      .slice(0, 16),
    range: input.range === "1y" || input.range === "3mo" ? input.range : "6mo",
  }))
  .handler(async ({ data }) => {
    if (!data.symbol) throw new Error("Escribe un símbolo");
    const bundle = await fetchChart(data.symbol, data.range);
    return analyzeBundle(bundle);
  });

export type IndexQuote = {
  symbol: string;
  label: string;
  price: number;
  changePct: number;
  spark: SparkPoint[];
};

export const fetchIndices = createServerFn({ method: "POST" })
  .validator(() => true)
  .handler(async () => {
    return Promise.all(
      INDEX_SYMBOLS.map(async (item) => {
        try {
          const bundle = await fetchChart(item.symbol, "3mo");
          return {
            symbol: item.symbol,
            label: item.label,
            price: bundle.meta.price,
            changePct: bundle.meta.changePct,
            spark: sparkline(bundle.bars, 22),
          };
        } catch {
          return {
            symbol: item.symbol,
            label: item.label,
            price: 0,
            changePct: 0,
            spark: [] as SparkPoint[],
          };
        }
      }),
    );
  });

export const fetchHotUniverse = createServerFn({ method: "POST" })
  .validator(() => true)
  .handler(async () => {
    const symbols = await fetchHotUnderlyings();
    return { symbols };
  });

export type RadarRow = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  score: number;
  kind: SignalKind;
  rsi: number | null;
};

export const fetchRadar = createServerFn({ method: "POST" })
  .validator(() => true)
  .handler(async () => {
    const rows: RadarRow[] = [];
    for (const symbol of RADAR_SYMBOLS) {
      try {
        const bundle = await fetchChart(symbol, "6mo");
        const analysis = analyzeBundle(bundle);
        rows.push({
          symbol: analysis.symbol,
          name: analysis.name,
          price: analysis.price,
          changePct: analysis.changePct,
          score: analysis.verdict.score,
          kind: analysis.verdict.kind,
          rsi: analysis.indicators.rsi14,
        });
      } catch {
        // keep going
      }
    }
    rows.sort((a, b) => b.score - a.score);
    return rows;
  });

export const searchTickers = createServerFn({ method: "POST" })
  .validator((q: string) => String(q ?? "").trim().slice(0, 40))
  .handler(async ({ data }) => searchSymbols(data));

export const interpretAnalysis = createServerFn({ method: "POST" })
  .validator((input: { symbol: string }) => ({
    symbol: String(input.symbol ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 16),
  }))
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "La capa de IA no está disponible aquí." };
    }
    const bundle = await fetchChart(data.symbol, "6mo");
    const analysis = analyzeBundle(bundle);
    const payload = {
      symbol: analysis.symbol,
      name: analysis.name,
      price: analysis.price,
      changePct: analysis.changePct,
      score: analysis.verdict.score,
      signal: analysis.verdict.kind,
      indicators: analysis.indicators,
      reasons: analysis.verdict.reasons,
    };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 280,
        messages: [
          {
            role: "system",
            content:
              "Eres un analista técnico sobrio. Responde en español, 3-5 frases. No inventes datos. No des consejo financiero personalizado. Explica la señal con los números dados. Termina con una frase de riesgo.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false as const, error: "No pude consultar al modelo." };
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      ok: true as const,
      text: body.choices?.[0]?.message?.content?.trim() || "",
    };
  });

export type ScanBatch = {
  hits: Ranked[];
  analyzed: number;
  omitted: string[];
  log: string[];
  minis: Record<string, SparkPoint[]>;
};

function trendFrom(kind: SignalKind, changePct: number): Trend {
  if (kind === "comprar" || changePct > 0.8) return "up";
  if (kind === "vender" || changePct < -0.8) return "down";
  return "flat";
}

function pickLegs(legs: LiveOption[], spot: number) {
  const ranked = legs
    .map((leg) => {
      const mid = (leg.bid + leg.ask) / 2 || leg.last;
      const spread = Math.max(0, (leg.ask || mid) - (leg.bid || 0));
      const spreadPct = mid > 0 ? spread / mid : 1;
      return {
        leg,
        mid,
        debit: mid * 100,
        dist: Math.abs(leg.strike - spot) / (spot || 1),
        spreadPct,
        flow: leg.volume + leg.openInterest * 0.4,
      };
    })
    .filter(
      (row) =>
        row.debit > 0.5 &&
        row.debit + 1 <= 1000 &&
        (row.spreadPct <= 0.45 || row.mid < 0.45),
    )
    .sort((a, b) => b.flow - a.flow || a.dist - b.dist);
  const used = new Set<string>();
  const out: LiveOption[] = [];
  for (const row of ranked) {
    const id = `${row.leg.strike}-${row.leg.expiration}`;
    if (used.has(id)) continue;
    used.add(id);
    out.push(row.leg);
    if (out.length >= 6) break;
  }
  return out;
}

export const scanBatch = createServerFn({ method: "POST" })
  .validator((input: {
    symbols: string[];
    side: Side;
    budget: number;
    dteMin: number;
    dteMax: number;
    largeCap?: boolean;
  }) => ({
    symbols: (input.symbols ?? [])
      .map((s) =>
        String(s)
          .toUpperCase()
          .replace(/[^A-Z0-9.^=-]/g, "")
          .slice(0, 12),
      )
      .filter(Boolean)
      .slice(0, 6),
    side: input.side === "call" || input.side === "put" ? input.side : "both",
    budget: Math.max(10, Math.min(Number(input.budget) || 100, 5000)),
    dteMin: Math.max(1, Math.min(Number(input.dteMin) || 2, 90)),
    dteMax: Math.max(1, Math.min(Number(input.dteMax) || 7, 120)),
    largeCap: Boolean(input.largeCap),
  }))
  .handler(async ({ data }): Promise<ScanBatch> => {
    const hits: Ranked[] = [];
    const omitted: string[] = [];
    const log: string[] = [];
    const minis: Record<string, SparkPoint[]> = {};
    let analyzed = 0;

    const jobs = data.symbols.map(async (symbol) => {
      try {
        const bundle = await fetchChart(symbol, "3mo");
        const analysis = analyzeBundle(bundle);
        analyzed += 1;
        minis[symbol] = sparkline(bundle.bars);
        const avgVol = analysis.indicators.volAvg20 ?? bundle.bars.at(-1)?.v ?? 0;
        if (data.largeCap && avgVol > 0 && avgVol < 1_500_000) {
          omitted.push(symbol);
          log.push(
            `${symbol} · omitido: volumen medio ${(avgVol / 1_000_000).toFixed(1)}M < 1.5M`,
          );
          return;
        }
        const chain = await fetchOptionChain(symbol, data.dteMin, data.dteMax);
        const trend = trendFrom(analysis.verdict.kind, analysis.changePct);
        const legs = [
          ...(data.side !== "put" ? pickLegs(chain.calls, chain.price || analysis.price) : []),
          ...(data.side !== "call" ? pickLegs(chain.puts, chain.price || analysis.price) : []),
        ];
        if (legs.length === 0) {
          omitted.push(symbol);
          log.push(
            `${symbol} · precio ${analysis.price.toFixed(2)} · venc. ${chain.expiration} · 0 contratos líquidos`,
          );
          return;
        }
        for (const leg of legs) {
          hits.push(
            scoreContract(
              {
                s: symbol,
                px: chain.price || analysis.price,
                t: leg.side,
                k: leg.strike,
                bid: leg.bid,
                ask: leg.ask,
                oi: leg.openInterest,
                vol: leg.volume,
                trend,
              },
              {
                techScore: analysis.verdict.score,
                kind: analysis.verdict.kind,
                name: analysis.name,
                iv: leg.iv,
                exp: leg.expiration,
                source: "live",
              },
            ),
          );
        }
        log.push(
          `${symbol} · ${analysis.name} · ${analysis.price.toFixed(2)} · ${chain.expiration} (${chain.dte} DTE) · ${legs.length} contrato(s)`,
        );
      } catch (error) {
        omitted.push(symbol);
        log.push(`${symbol} · omitido: ${error instanceof Error ? error.message : "sin datos"}`);
      }
    });
    await Promise.all(jobs);

    hits.sort(
      (a, b) =>
        b.vol + b.oi * 0.4 - (a.vol + a.oi * 0.4) ||
        b.score - a.score ||
        (a.exp && b.exp ? dte(a.exp) - dte(b.exp) : 0),
    );
    return { hits, analyzed, omitted, log, minis };
  });

export type EquityBatch = {
  hits: EquityHit[];
  omitted: string[];
  log: string[];
  minis: Record<string, SparkPoint[]>;
};

export const scanEquities = createServerFn({ method: "POST" })
  .validator((input: { symbols: string[]; largeCap?: boolean }) => ({
    symbols: (input.symbols ?? [])
      .map((s) =>
        String(s)
          .toUpperCase()
          .replace(/[^A-Z0-9.^=-]/g, "")
          .slice(0, 12),
      )
      .filter(Boolean)
      .slice(0, 8),
    largeCap: Boolean(input.largeCap),
  }))
  .handler(async ({ data }): Promise<EquityBatch> => {
    const hits: EquityHit[] = [];
    const omitted: string[] = [];
    const log: string[] = [];
    const minis: Record<string, SparkPoint[]> = {};

    await Promise.all(
      data.symbols.map(async (symbol) => {
        try {
          const bundle = await fetchChart(symbol, "3mo");
          const analysis = analyzeBundle(bundle);
          const closes = bundle.bars.map((b) => b.c).filter((c) => c > 0);
          const avgVol = analysis.indicators.volAvg20 ?? bundle.bars.at(-1)?.v ?? 0;
          if (data.largeCap && avgVol > 0 && avgVol < 1_500_000) {
            omitted.push(symbol);
            log.push(
              `${symbol} · omitido: volumen medio ${(avgVol / 1_000_000).toFixed(1)}M < 1.5M`,
            );
            return;
          }
          minis[symbol] = sparkline(bundle.bars);
          hits.push({
            s: analysis.symbol,
            name: analysis.name,
            px: analysis.price,
            changePct: analysis.changePct,
            score: analysis.verdict.score,
            kind: analysis.verdict.kind,
            rsi: analysis.indicators.rsi14,
            sma20: analysis.indicators.sma20,
            sma50: analysis.indicators.sma50,
            hv: histVol(closes),
            volume: bundle.bars.at(-1)?.v ?? 0,
            weekHigh: analysis.weekHigh,
            weekLow: analysis.weekLow,
          });
          log.push(
            `${analysis.symbol} · ${analysis.name} · ${analysis.price.toFixed(2)} · ${analysis.verdict.kind} · score ${analysis.verdict.score}`,
          );
        } catch (error) {
          omitted.push(symbol);
          log.push(`${symbol} · omitido: ${error instanceof Error ? error.message : "sin datos"}`);
        }
      }),
    );

    hits.sort((a, b) => b.score - a.score || Math.abs(b.changePct) - Math.abs(a.changePct));
    return { hits, omitted, log, minis };
  });

