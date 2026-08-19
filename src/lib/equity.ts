import type { SignalKind } from "./analysis";
import { histDrift, histVol, nCdf } from "./estimate";
import { stockFee } from "./fees";

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
  fees: number;
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
  "WMT",
  "KO",
  "PEP",
  "DIS",
  "INTC",
  "BA",
  "WFC",
  "CVX",
  "ABBV",
];

export const ETF_SYMBOLS = [
  "SPY",
  "QQQ",
  "DIA",
  "VOO",
  "VTI",
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "XLI",
  "SMH",
  "GLD",
  "TLT",
  "EEM",
  "IWM",
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
  const fees = stockFee(shares) * 2;
  const hv = hit.hv || histVol(closes.length ? closes : [px * 0.97, px]);
  const T = Math.max(dte, 1) / 365;
  const drift = histDrift(closes, hit.kind === "comprar");
  const expectedSpot = px * Math.exp(drift * T);
  const expectedPnl = (expectedSpot - px) * shares - fees;
  const expectedMovePct = (Math.exp(hv * Math.sqrt(T)) - 1) * 100;
  const vol = hv * Math.sqrt(T) || 1e-9;
  const pUp = 1 - nCdf((0 - (drift - 0.5 * hv * hv) * T) / vol);
  return {
    shares,
    capital,
    expectedPnl,
    expectedPnlPct: capital ? (expectedPnl / capital) * 100 : 0,
    queda: capital + expectedPnl,
    expectedMovePct,
    hv,
    pUp: Math.max(0.05, Math.min(0.95, pUp)),
    fees,
  };
}
