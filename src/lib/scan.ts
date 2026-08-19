export type Side = "call" | "put" | "both";
export type Trend = "up" | "down" | "flat";

export type Contract = {
  s: string;
  px: number;
  t: "call" | "put";
  k: number;
  bid: number;
  ask: number;
  oi: number;
  vol: number;
  trend: Trend;
};

export type Ranked = Contract & {
  mid: number;
  debit: number;
  spread: number;
  score: number;
  why: string;
  name?: string;
  iv?: number;
  exp?: string;
  source?: "live" | "sample";
  techScore?: number;
  parts?: { liq: number; tech: number; dir: number };
};

export const SCAN_SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "TSLA",
  "AMD",
  "GOOGL",
  "NFLX",
  "AVGO",
  "PLTR",
  "SMCI",
  "JPM",
  "XOM",
  "ORCL",
  "CRM",
  "UBER",
  "COIN",
  "SOFI",
  "F",
  "BA",
  "INTC",
];

/** Respaldo si Yahoo no entrega cadena. */
export const UNIVERSE: Contract[] = [
  { s: "SPY", px: 562, t: "call", k: 565, bid: 1.42, ask: 1.48, oi: 82000, vol: 54000, trend: "up" },
  { s: "SPY", px: 562, t: "put", k: 558, bid: 1.18, ask: 1.24, oi: 61000, vol: 28000, trend: "up" },
  { s: "QQQ", px: 492, t: "call", k: 495, bid: 1.55, ask: 1.62, oi: 54000, vol: 41000, trend: "up" },
  { s: "QQQ", px: 492, t: "put", k: 488, bid: 1.3, ask: 1.38, oi: 33000, vol: 19000, trend: "up" },
  { s: "IWM", px: 221, t: "call", k: 223, bid: 0.88, ask: 0.96, oi: 21000, vol: 16000, trend: "flat" },
  { s: "AAPL", px: 310.5, t: "call", k: 315, bid: 1.85, ask: 2.05, oi: 18420, vol: 9320, trend: "up" },
  { s: "AAPL", px: 310.5, t: "call", k: 320, bid: 0.92, ask: 1.08, oi: 22110, vol: 15400, trend: "up" },
  { s: "AAPL", px: 310.5, t: "put", k: 305, bid: 1.7, ask: 1.9, oi: 9900, vol: 4100, trend: "up" },
  { s: "NVDA", px: 178.2, t: "call", k: 180, bid: 3.1, ask: 3.35, oi: 40120, vol: 28000, trend: "up" },
  { s: "NVDA", px: 178.2, t: "call", k: 185, bid: 1.45, ask: 1.62, oi: 33000, vol: 19000, trend: "up" },
  { s: "NVDA", px: 178.2, t: "put", k: 175, bid: 2.2, ask: 2.4, oi: 21000, vol: 12000, trend: "up" },
  { s: "TSLA", px: 332, t: "call", k: 340, bid: 4.8, ask: 5.1, oi: 15000, vol: 22000, trend: "down" },
  { s: "TSLA", px: 332, t: "put", k: 320, bid: 3.4, ask: 3.65, oi: 11000, vol: 18000, trend: "down" },
  { s: "AMD", px: 158.4, t: "call", k: 160, bid: 2.05, ask: 2.2, oi: 8700, vol: 6400, trend: "up" },
  { s: "META", px: 528, t: "call", k: 530, bid: 6.1, ask: 6.4, oi: 5400, vol: 3900, trend: "flat" },
  { s: "MSFT", px: 428, t: "call", k: 430, bid: 3.55, ask: 3.8, oi: 9800, vol: 6100, trend: "up" },
  { s: "AMZN", px: 198, t: "call", k: 200, bid: 1.72, ask: 1.84, oi: 24000, vol: 21000, trend: "up" },
  { s: "GOOGL", px: 176, t: "call", k: 178, bid: 1.22, ask: 1.32, oi: 19000, vol: 14000, trend: "up" },
  { s: "NFLX", px: 712, t: "put", k: 700, bid: 4.1, ask: 4.4, oi: 7200, vol: 8800, trend: "down" },
  { s: "AVGO", px: 248, t: "call", k: 250, bid: 2.05, ask: 2.18, oi: 13000, vol: 11200, trend: "up" },
  { s: "PLTR", px: 42.8, t: "call", k: 44, bid: 0.62, ask: 0.7, oi: 28000, vol: 34000, trend: "up" },
  { s: "SMCI", px: 48.2, t: "call", k: 50, bid: 0.78, ask: 0.88, oi: 15000, vol: 26000, trend: "flat" },
  { s: "SPY", px: 562, t: "call", k: 575, bid: 0.18, ask: 0.22, oi: 45000, vol: 38000, trend: "up" },
  { s: "QQQ", px: 492, t: "call", k: 505, bid: 0.12, ask: 0.16, oi: 22000, vol: 19000, trend: "up" },
  { s: "AAPL", px: 310.5, t: "call", k: 330, bid: 0.18, ask: 0.24, oi: 16000, vol: 14000, trend: "up" },
  { s: "NVDA", px: 178.2, t: "call", k: 195, bid: 0.2, ask: 0.26, oi: 18000, vol: 21000, trend: "up" },
  { s: "PLTR", px: 42.8, t: "call", k: 46, bid: 0.14, ask: 0.18, oi: 24000, vol: 31000, trend: "up" },
  { s: "F", px: 11.4, t: "call", k: 12, bid: 0.07, ask: 0.1, oi: 28000, vol: 25000, trend: "flat" },
  { s: "SOFI", px: 16.8, t: "call", k: 18, bid: 0.12, ask: 0.16, oi: 21000, vol: 24000, trend: "up" },
];

export function nextFriday(from = new Date()) {
  const d = new Date(from);
  const dow = d.getDay();
  const add = dow === 5 ? (d.getHours() >= 16 ? 7 : 0) : (5 - dow + 7) % 7;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function iso(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function dte(exp: string) {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(`${exp}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function parseSymbols(raw: string) {
  return raw
    .toUpperCase()
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function why(c: Ranked): string {
  const parts: string[] = [];
  if (c.source === "live") parts.push("cadena en vivo");
  if (c.vol >= 20000) parts.push("muy activa");
  else if (c.vol >= 10000) parts.push("activa");
  if (c.mid > 0 && c.spread / c.mid <= 0.08) parts.push("spread estrecho");
  if ((c.trend === "up" && c.t === "call") || (c.trend === "down" && c.t === "put")) {
    parts.push("a favor de tendencia");
  }
  if (c.oi >= 20000) parts.push("alta liquidez");
  return parts.join(" · ") || "entra en presupuesto";
}

export function scoreContract(
  c: Contract,
  extras: {
    techScore?: number;
    kind?: "comprar" | "esperar" | "vender";
    name?: string;
    iv?: number;
    exp?: string;
    source?: "live" | "sample";
  } = {},
): Ranked {
  const mid = (c.bid + c.ask) / 2 || Math.max(c.bid, c.ask, 0);
  const debit = mid * 100;
  const spread = Math.max(0, c.ask - c.bid);
  const spreadPct = mid > 0 ? spread / mid : 1;
  const liq = Math.round(
    Math.min(c.vol / 25000, 1) * 22 +
      Math.min(c.oi / 40000, 1) * 12 +
      Math.max(0, 1 - spreadPct / 0.18) * 14,
  );
  const aligned =
    (extras.kind === "comprar" && c.t === "call") ||
    (extras.kind === "vender" && c.t === "put") ||
    (c.trend === "up" && c.t === "call") ||
    (c.trend === "down" && c.t === "put");
  const dir = aligned ? 18 : extras.kind === "esperar" ? 7 : 3;
  const tech = Math.round(Math.max(0, Math.min(extras.techScore ?? 50, 100)) * 0.34);
  const penalty = spreadPct > 0.22 || (c.vol < 50 && extras.source === "live") ? 12 : 0;
  const score = Math.max(0, Math.min(100, liq + tech + dir - penalty));
  const row: Ranked = {
    ...c,
    mid,
    debit,
    spread,
    score,
    why: "",
    name: extras.name,
    iv: extras.iv,
    exp: extras.exp,
    source: extras.source ?? "sample",
    techScore: extras.techScore,
    parts: { liq, tech, dir },
  };
  row.why = why(row);
  return row;
}

export function rankContracts(input: {
  symbols: string[];
  side: Side;
  budget: number;
}): { hits: Ranked[]; auto: boolean } {
  const auto = input.symbols.length === 0;
  const pool = auto ? UNIVERSE : UNIVERSE.filter((c) => input.symbols.includes(c.s));
  const hits = pool
    .filter((c) => input.side === "both" || c.t === input.side)
    .map((c) => scoreContract(c, { source: "sample" }))
    .filter((c) => c.debit > 0 && c.debit <= input.budget)
    .sort((a, b) => b.score - a.score || b.vol - a.vol);
  return { hits, auto };
}
