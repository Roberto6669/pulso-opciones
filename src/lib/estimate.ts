import type { Indicators } from "./analysis";
import type { Ranked } from "./scan";

export type Scenario = {
  id: string;
  label: string;
  spot: number;
  movePct: number;
  value: number;
  pnl: number;
  pnlPct: number;
};

export type HistTrade = {
  from: number;
  to: number;
  entry: number;
  exit: number;
  pnl: number;
  pnlPct: number;
};

export type Estimate = {
  contracts: number;
  capital: number;
  debitEach: number;
  maxLoss: number;
  breakeven: number;
  hv: number;
  expectedMovePct: number;
  pProfit: number;
  expectedPnl: number;
  expectedPnlPct: number;
  fair: number;
  featured: Scenario;
  scenarios: Scenario[];
  lastWindow: HistTrade | null;
  payoff: Array<{ spot: number; pnl: number }>;
  backtest: {
    trades: number;
    wins: number;
    winRate: number;
    avgPnl: number;
    medianPnl: number;
    recent: HistTrade[];
  };
};

function intrinsic(side: "call" | "put", strike: number, spot: number) {
  return side === "call" ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
}

function nCdf(x: number) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function bsPrice(S: number, K: number, T: number, sigma: number, side: "call" | "put") {
  if (T <= 1 / 365 || sigma <= 0) return intrinsic(side, K, S);
  const v = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / v;
  const d2 = d1 - v;
  if (side === "call") return Math.max(0, S * nCdf(d1) - K * nCdf(d2));
  return Math.max(0, K * nCdf(-d2) - S * nCdf(-d1));
}

export function histVol(closes: number[]) {
  if (closes.length < 12) return 0.28;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i] > 0 && closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 8) return 0.28;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.min(1.2, Math.max(0.1, Math.sqrt(v * 252)));
}

function histDrift(closes: number[], aligned: boolean) {
  if (closes.length < 20) return aligned ? 0.06 : 0;
  const n = Math.min(closes.length - 1, 60);
  const a = closes[closes.length - 1 - n];
  const b = closes[closes.length - 1];
  if (a <= 0 || b <= 0) return 0;
  const annual = Math.log(b / a) * (252 / n);
  const capped = Math.max(-0.35, Math.min(0.35, annual));
  return aligned ? capped * 0.5 : capped * 0.15;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function tradingDays(dte: number) {
  return Math.max(1, Math.round((Math.max(dte, 1) * 5) / 7));
}

export function estimatePayoff(
  contract: Ranked,
  spot: number,
  budget: number,
  opts?: {
    dte?: number;
    closes?: number[];
    times?: number[];
    indicators?: Indicators | null;
    bands?: { upper: number | null; lower: number | null };
  },
): Estimate {
  const n = Math.max(1, Math.floor(budget / contract.debit));
  const capital = n * contract.debit;
  const dte = Math.max(opts?.dte ?? 5, 0);
  const T = Math.max(dte, 1) / 365;
  const closes = opts?.closes?.filter((c) => c > 0) ?? [];
  const hv = histVol(closes.length ? closes : [spot * 0.95, spot]);
  // Las primas de muestra van con un px viejo. El strike se mueve
  // a la misma distancia % sobre el spot real para no inventar ITM fantasma.
  const ref = contract.px > 0 ? contract.px : spot;
  const moneyness = contract.k / ref;
  const liveK = spot > 0 ? spot * moneyness : contract.k;
  const aligned =
    (contract.trend === "up" && contract.t === "call") ||
    (contract.trend === "down" && contract.t === "put");
  let mu = histDrift(closes, aligned);
  const rsi = opts?.indicators?.rsi14;
  if (rsi != null) {
    if (contract.t === "call" && rsi > 72) mu -= 0.08;
    if (contract.t === "put" && rsi < 28) mu += 0.04;
    if (contract.t === "call" && rsi < 35) mu += 0.03;
  }
  if (opts?.indicators?.macdHist != null) {
    mu += opts.indicators.macdHist > 0 ? 0.03 : -0.03;
  }

  const breakeven =
    contract.t === "call" ? liveK + contract.mid : liveK - contract.mid;
  const expectedSpot = spot * Math.exp(mu * T);
  const expectedMovePct = (Math.exp(hv * Math.sqrt(T)) - 1) * 100;
  const zBe = Math.log(breakeven / spot);
  const pProfit =
    contract.t === "call"
      ? 1 - nCdf((zBe - (mu - 0.5 * hv * hv) * T) / (hv * Math.sqrt(T)))
      : nCdf((zBe - (mu - 0.5 * hv * hv) * T) / (hv * Math.sqrt(T)));

  const fair = bsPrice(spot, liveK, T, hv, contract.t);
  const expectedPnl = (fair - contract.mid) * 100 * n;
  const expectedPnlPct = capital ? (expectedPnl / capital) * 100 : 0;

  const atSigma = (z: number) => spot * Math.exp((mu - 0.5 * hv * hv) * T + z * hv * Math.sqrt(T));

  const pack = (id: string, label: string, at: number): Scenario => {
    const value = intrinsic(contract.t, liveK, at);
    const pnl = (value - contract.mid) * 100 * n;
    return {
      id,
      label,
      spot: at,
      movePct: spot ? ((at - spot) / spot) * 100 : 0,
      value,
      pnl,
      pnlPct: capital ? (pnl / capital) * 100 : 0,
    };
  };

  const scenarios: Scenario[] = [
    pack("m2", "Movimiento −2σ (raro)", atSigma(-2)),
    pack("m1", "Movimiento −1σ (típico bajo)", atSigma(-1)),
    pack("exp", "Precio esperado (tendencia + historial)", expectedSpot),
    pack("p1", "Movimiento +1σ (típico alto)", atSigma(1)),
    pack("p2", "Movimiento +2σ (raro)", atSigma(2)),
    pack("flat", "El precio no se mueve", spot),
  ];

  const bbU = opts?.bands?.upper ?? opts?.indicators?.bbUpper ?? null;
  const bbL = opts?.bands?.lower ?? opts?.indicators?.bbLower ?? null;
  if (contract.t === "call" && bbU && Math.abs(bbU / spot - 1) <= hv * Math.sqrt(T) * 2.2) {
    scenarios.push(pack("bb", "Banda superior de Bollinger", bbU));
  }
  if (contract.t === "put" && bbL && Math.abs(1 - bbL / spot) <= hv * Math.sqrt(T) * 2.2) {
    scenarios.push(pack("bb", "Banda inferior de Bollinger", bbL));
  }

  const featured = pack("ev", "Valor esperado (vol histórica + tendencia)", expectedSpot);
  featured.pnl = expectedPnl;
  featured.pnlPct = expectedPnlPct;
  featured.value = fair;

  const step = tradingDays(dte);
  const times = opts?.times ?? [];
  const trades: HistTrade[] = [];
  if (closes.length > step + 5) {
    for (let i = 0; i + step < closes.length; i += Math.max(1, Math.floor(step / 2))) {
      const S0 = closes[i];
      const S1 = closes[i + step];
      const K = S0 * moneyness;
      const entry = Math.max(bsPrice(S0, K, T, hv, contract.t), 0.05);
      const exit = intrinsic(contract.t, K, S1);
      const pnlEach = (exit - entry) * 100;
      const qty = Math.max(1, Math.floor(budget / (entry * 100)));
      trades.push({
        from: times[i] ?? i,
        to: times[i + step] ?? i + step,
        entry,
        exit,
        pnl: pnlEach * qty,
        pnlPct: entry ? ((exit - entry) / entry) * 100 : 0,
      });
    }
  }

  const lastWindow = trades.length ? trades[trades.length - 1] : null;
  const pnls = trades.map((t) => t.pnl);
  const lo = spot * 0.88;
  const hi = spot * 1.12;
  const payoff = Array.from({ length: 25 }, (_, i) => {
    const at = lo + ((hi - lo) * i) / 24;
    const value = intrinsic(contract.t, liveK, at);
    return { spot: at, pnl: (value - contract.mid) * 100 * n };
  });

  return {
    contracts: n,
    capital,
    debitEach: contract.debit,
    maxLoss: capital,
    breakeven,
    hv,
    expectedMovePct,
    pProfit: Math.max(0, Math.min(1, pProfit)),
    expectedPnl,
    expectedPnlPct,
    fair,
    featured,
    scenarios,
    lastWindow,
    payoff,
    backtest: {
      trades: trades.length,
      wins: trades.filter((t) => t.pnl > 0).length,
      winRate: trades.length ? trades.filter((t) => t.pnl > 0).length / trades.length : 0,
      avgPnl: pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0,
      medianPnl: median(pnls),
      recent: trades.slice(-8).reverse(),
    },
  };
}
