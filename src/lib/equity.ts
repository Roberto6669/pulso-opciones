import type { SignalKind } from "./analysis";
import { histVol } from "./estimate";

export type MarketMode = "options" | "stocks" | "etf";

export type EquityHit = {
  s: string;
  name: string;
  px: number;
  changePct: number;
  score: number;
  kind: SignalKind;
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  hv: number;
  volume: number;
  weekHigh: number;
  weekLow: number;
};

export type EquityEstimate = {
  shares: number;
  capital: number;
  expectedPnl: number;
  expectedPnlPct: number;
  queda: number;
  expectedMovePct: number;
  hv: number;
  pUp: number;
};

export const STOCK_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOGL",
  "TSLA",
  "AVGO",
  "JPM",
  "UNH",
  "XOM",
  "LLY",
  "V",
  "MA",
  "ORCL",
  "HD",
  "COST",
  "NFLX",
  "AMD",
  "CRM",
  "BAC",
  "KO",
  "PEP",
  "DIS",
  "INTC",
  "BA",
  "UBER",
  "PLTR",
  "COIN",
  "SMCI",
];

export const ETF_SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "VOO",
  "VTI",
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "SMH",
  "SOXL",
  "TQQQ",
  "GLD",
  "SLV",
  "TLT",
  "HYG",
  "EEM",
  "ARKK",
  "IYR",
];

export function modeLabel(mode: MarketMode) {
  if (mode === "stocks") return "Acciones";
  if (mode === "etf") return "ETF";
  return "Opciones";
}

export function estimateEquity(
  hit: EquityHit,
  budget: number,
  dte: number,
  closes: number[] = [],
): EquityEstimate {
  const px = hit.px > 0 ? hit.px : 1;
  const shares = Math.max(1, Math.floor(budget / px));
  const capital = shares * px;
  const hv = hit.hv || histVol(closes.length ? closes : [px * 0.97, px]);
  const T = Math.max(dte, 1) / 365;
  const drift =
    hit.kind === "comprar" ? 0.08 : hit.kind === "vender" ? -0.06 : 0.02;
  const expectedSpot = px * Math.exp(drift * T);
  const expectedPnl = (expectedSpot - px) * shares;
  const expectedMovePct = (Math.exp(hv * Math.sqrt(T)) - 1) * 100;
  const z = (Math.log(1) - (drift - 0.5 * hv * hv) * T) / (hv * Math.sqrt(T) || 1);
  const pUp = 1 - 0.5 * (1 + Math.sign(z) * (1 - Math.exp((-2 * z * z) / Math.PI)));
  return {
    shares,
    capital,
    expectedPnl,
    expectedPnlPct: capital ? (expectedPnl / capital) * 100 : 0,
    queda: capital + expectedPnl,
    expectedMovePct,
    hv,
    pUp: Math.max(0.05, Math.min(0.95, pUp)),
  };
}
