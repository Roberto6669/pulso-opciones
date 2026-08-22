import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Bar } from "./analysis";
import { SCAN_SYMBOLS, UNIVERSE } from "./scan";

const execFileAsync = promisify(execFile);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

function remember<T>(key: string, value: T): T {
  cache.set(key, { at: Date.now(), value });
  return value;
}

function cached<T>(key: string, ttlMs: number): T | null {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return hit.value;
}

function stale<T>(key: string, maxMs: number): T | null {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (!hit) return null;
  if (Date.now() - hit.at > maxMs) return null;
  return hit.value;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function money(raw: string | null | undefined): number {
  if (!raw) return NaN;
  return Number(String(raw).replace(/[$,+%]/g, "").replace(/,/g, "").trim());
}

function parseUsDate(raw: string): number {
  const [m, d, y] = raw.split("/").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

async function nasdaqJson<T>(url: string): Promise<T> {
  let last = "Nasdaq sin respuesta";
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/plain,*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Origin: "https://www.nasdaq.com",
          Referer: "https://www.nasdaq.com/",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429 || res.status >= 500) {
        last = `Nasdaq ${res.status}`;
        await sleep(400 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Datos ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
      await sleep(400 * (i + 1));
    }
  }
  try {
    return await curlJson<T>(url);
  } catch {
    throw new Error(last);
  }
}

async function curlJson<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync(
    "curl",
    ["-sS", "-A", UA, "-H", "Accept: application/json", "--compressed", "--max-time", "12", url],
    { maxBuffer: 5_000_000 },
  );
  return JSON.parse(stdout) as T;
}

async function jsonGet<T>(url: string): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    try {
      return await curlJson<T>(url);
    } catch {
      throw error instanceof Error ? error : new Error("sin datos");
    }
  }
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return await res.text();
  } catch {
    /* Docker often has no curl */
  }
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-sS", "-A", UA, "--compressed", "--max-time", "15", url],
      { maxBuffer: 4_000_000 },
    );
    return stdout;
  } catch {
    return "";
  }
}

function assetClass(symbol: string, hinted?: string): "etf" | "stocks" {
  if (hinted === "etf" || hinted === "ETF") return "etf";
  const etfs = new Set(["SPY", "DIA", "QQQ", "IWM", "VXX", "UVXY", "TLT", "GLD", "SLV", "SOXL"]);
  return etfs.has(symbol.toUpperCase()) ? "etf" : "stocks";
}

type InfoPayload = {
  data?: {
    symbol?: string;
    companyName?: string;
    exchange?: string;
    primaryData?: {
      lastSalePrice?: string;
      netChange?: string;
      percentageChange?: string;
      volume?: string;
    };
    keyStats?: {
      fiftyTwoWeekHighLow?: { value?: string };
      dayrange?: { value?: string };
    };
  };
};

type HistPayload = {
  data?: {
    symbol?: string;
    tradesTable?: {
      rows?: Array<{
        date?: string;
        close?: string;
        volume?: string;
        open?: string;
        high?: string;
        low?: string;
      }>;
    };
  };
};

export type QuoteMeta = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  weekHigh: number;
  weekLow: number;
  exchange: string;
};

export type ChartBundle = { meta: QuoteMeta; bars: Bar[] };

function seedFrom(sym: string) {
  let h = 2166136261;
  for (let i = 0; i < sym.length; i += 1) h = Math.imul(h ^ sym.charCodeAt(i), 16777619);
  return h >>> 0;
}

function fallbackBars(sym: string): Bar[] {
  const px = UNIVERSE.find((c) => c.s === sym)?.px ?? 100;
  let x = seedFrom(sym) || 1;
  const rand = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967295;
  };
  const bars: Bar[] = [];
  let c = px * 0.86;
  const start = Date.UTC(2025, 8, 1);
  for (let i = 0; i < 220; i += 1) {
    const drift = (px - c) * 0.02;
    const chg = (rand() - 0.48) * c * 0.018 + drift;
    const o = c;
    c = Math.max(1, c + chg);
    const h = Math.max(o, c) * (1 + rand() * 0.008);
    const l = Math.min(o, c) * (1 - rand() * 0.008);
    bars.push({
      t: start + i * 86400000,
      o,
      h,
      l,
      c,
      v: Math.round(8_000_000 + rand() * 40_000_000),
    });
  }
  return bars;
}

function metaFromBars(sym: string, bars: Bar[], name: string, exchange: string): QuoteMeta {
  const last = bars.at(-1)!;
  const prev = bars.at(-2)?.c ?? last.c;
  return {
    symbol: sym,
    name,
    currency: "USD",
    price: last.c,
    previousClose: prev,
    change: last.c - prev,
    changePct: prev ? ((last.c - prev) / prev) * 100 : 0,
    dayHigh: last.h,
    dayLow: last.l,
    weekHigh: Math.max(...bars.map((b) => b.h)),
    weekLow: Math.min(...bars.map((b) => b.l)),
    exchange,
  };
}

async function fetchNasdaq(sym: string): Promise<ChartBundle> {
  const cls = assetClass(sym);
  const today = new Date();
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 320);
  const fromdate = from.toISOString().slice(0, 10);
  const todate = today.toISOString().slice(0, 10);

  const [info, hist] = await Promise.all([
    nasdaqJson<InfoPayload>(
      `https://api.nasdaq.com/api/quote/${encodeURIComponent(sym)}/info?assetclass=${cls}`,
    ),
    nasdaqJson<HistPayload>(
      `https://api.nasdaq.com/api/quote/${encodeURIComponent(sym)}/historical?assetclass=${cls}&fromdate=${fromdate}&todate=${todate}&limit=220`,
    ),
  ]);

  const rows = hist.data?.tradesTable?.rows ?? [];
  const bars: Bar[] = rows
    .map((row) => ({
      t: parseUsDate(row.date ?? ""),
      o: money(row.open),
      h: money(row.high),
      l: money(row.low),
      c: money(row.close),
      v: money(row.volume),
    }))
    .filter((b) => Number.isFinite(b.c) && Number.isFinite(b.o) && b.t > 0)
    .sort((a, b) => a.t - b.t);

  if (bars.length < 30) throw new Error(`Historial corto para ${sym}`);

  const primary = info.data?.primaryData;
  const price = money(primary?.lastSalePrice) || bars.at(-1)!.c;
  const change = money(primary?.netChange);
  const changePct = money(primary?.percentageChange);
  const prev =
    Number.isFinite(change) && change !== 0 ? price - change : bars.at(-2)?.c ?? price;
  const range52 = info.data?.keyStats?.fiftyTwoWeekHighLow?.value ?? "";
  const [weekLowRaw, weekHighRaw] = range52.split("-").map((p) => money(p));
  const day = info.data?.keyStats?.dayrange?.value ?? "";
  const [dayLowRaw, dayHighRaw] = day.split("-").map((p) => money(p));

  return {
    meta: {
      symbol: info.data?.symbol || sym,
      name: (info.data?.companyName || sym).replace(/ Common Stock$/i, ""),
      currency: "USD",
      price,
      previousClose: prev,
      change: Number.isFinite(change) ? change : price - prev,
      changePct: Number.isFinite(changePct) ? changePct : prev ? ((price - prev) / prev) * 100 : 0,
      dayHigh: Number.isFinite(dayHighRaw) ? dayHighRaw : bars.at(-1)!.h,
      dayLow: Number.isFinite(dayLowRaw) ? dayLowRaw : bars.at(-1)!.l,
      weekHigh: Number.isFinite(weekHighRaw) ? weekHighRaw : Math.max(...bars.map((b) => b.h)),
      weekLow: Number.isFinite(weekLowRaw) ? weekLowRaw : Math.min(...bars.map((b) => b.l)),
      exchange: info.data?.exchange || "",
    },
    bars,
  };
}

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { symbol?: string; regularMarketPrice?: number; currency?: string; exchangeName?: string; shortName?: string };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

async function fetchYahoo(sym: string, range: string): Promise<ChartBundle> {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d&includePrePost=false`,
  ];
  let body: YahooChart | null = null;
  let lastErr = "Yahoo vacío";
  for (const url of urls) {
    try {
      body = await jsonGet<YahooChart>(url);
      if (body.chart?.result?.[0]) break;
    } catch (error) {
      lastErr = error instanceof Error ? error.message : lastErr;
    }
  }
  const result = body?.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const ts = result?.timestamp ?? [];
  if (!result || !quote || ts.length < 30) throw new Error(lastErr);
  const bars: Bar[] = ts
    .map((t, i) => ({
      t: t * 1000,
      o: Number(quote.open?.[i]),
      h: Number(quote.high?.[i]),
      l: Number(quote.low?.[i]),
      c: Number(quote.close?.[i]),
      v: Number(quote.volume?.[i]),
    }))
    .filter((b) => Number.isFinite(b.c) && Number.isFinite(b.o));
  if (bars.length < 30) throw new Error("Yahoo corto");
  const last = bars.at(-1)!;
  const price = result.meta?.regularMarketPrice || last.c;
  return {
    meta: {
      symbol: result.meta?.symbol || sym,
      name: result.meta?.shortName || sym,
      currency: result.meta?.currency || "USD",
      price,
      previousClose: bars.at(-2)?.c ?? price,
      change: price - (bars.at(-2)?.c ?? price),
      changePct: bars.at(-2)?.c ? ((price - bars.at(-2)!.c) / bars.at(-2)!.c) * 100 : 0,
      dayHigh: last.h,
      dayLow: last.l,
      weekHigh: Math.max(...bars.map((b) => b.h)),
      weekLow: Math.min(...bars.map((b) => b.l)),
      exchange: result.meta?.exchangeName || "",
    },
    bars,
  };
}

export async function fetchChart(symbol: string, range = "6mo"): Promise<ChartBundle> {
  const sym = symbol.toUpperCase();
  const key = `chart:${sym}:${range}`;
  const fresh = cached<ChartBundle>(key, 90_000);
  if (fresh) return fresh;
  const span = range === "1y" ? "1y" : range === "3mo" ? "3mo" : "6mo";

  try {
    return remember(key, await fetchYahoo(sym, span));
  } catch {
    /* nasdaq */
  }
  try {
    return remember(key, await fetchNasdaq(sym));
  } catch {
    /* last resort so the chart UI is never blank */
  }
  const bars = fallbackBars(sym);
  return remember(key, {
    meta: metaFromBars(sym, bars, `${sym} (muestra)`, "DEMO"),
    bars,
  });
}

type LookupPayload = {
  data?: Array<{
    symbol?: string;
    name?: string;
    asset?: string;
    exchange?: string;
  }>;
};

export type SearchHit = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
};

type YahooOption = {
  strike?: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
};

type YahooOptions = {
  optionChain?: {
    result?: Array<{
      expirationDates?: number[];
      quote?: { regularMarketPrice?: number; shortName?: string };
      options?: Array<{
        expirationDate?: number;
        calls?: YahooOption[];
        puts?: YahooOption[];
      }>;
    }>;
  };
};

export type LiveOption = {
  side: "call" | "put";
  strike: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  iv: number;
  expiration: string;
  expirationUnix: number;
};

export type LiveChain = {
  symbol: string;
  name: string;
  price: number;
  expiration: string;
  expirationUnix: number;
  dte: number;
  calls: LiveOption[];
  puts: LiveOption[];
};

function unixToIso(unix: number) {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function pickExpiration(dates: number[], dteMin: number, dteMax: number) {
  const now = Date.now() / 1000;
  const scored = dates
    .map((unix) => ({ unix, days: (unix - now) / 86400 }))
    .filter((row) => row.days >= Math.max(0.75, dteMin - 0.4));
  if (!scored.length) {
    const future = dates
      .map((unix) => ({ unix, days: (unix - now) / 86400 }))
      .filter((row) => row.days >= 0.75)
      .sort((a, b) => a.days - b.days);
    return (future[0] ?? { unix: dates[0] }).unix;
  }
  const inRange = scored.filter((row) => row.days <= dteMax + 0.6);
  const pool = inRange.length ? inRange : scored;
  if (dteMax <= 7) {
    pool.sort((a, b) => a.days - b.days);
    return pool[0].unix;
  }
  const mid = (dteMin + dteMax) / 2;
  pool.sort((a, b) => Math.abs(a.days - mid) - Math.abs(b.days - mid));
  return pool[0].unix;
}

type NasdaqChain = {
  data?: {
    lastTrade?: string;
    table?: {
      rows?: Array<{
        expirygroup?: string | null;
        expiryDate?: string | null;
        strike?: string | null;
        c_Bid?: string | null;
        c_Ask?: string | null;
        c_Last?: string | null;
        c_Volume?: string | null;
        c_Openinterest?: string | null;
        p_Bid?: string | null;
        p_Ask?: string | null;
        p_Last?: string | null;
        p_Volume?: string | null;
        p_Openinterest?: string | null;
      }>;
    };
  };
};

function parseExpiryGroup(raw: string) {
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return {
    iso: d.toISOString().slice(0, 10),
    unix: Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000),
  };
}

function nasdaqNum(raw: string | null | undefined) {
  if (!raw || raw === "--") return 0;
  return money(raw);
}

async function fetchNasdaqOptions(sym: string, dteMin: number, dteMax: number): Promise<LiveChain> {
  const cls = assetClass(sym);
  const body = await nasdaqJson<NasdaqChain>(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(sym)}/option-chain?assetclass=${cls}&limit=0`,
  );
  const rows = body.data?.table?.rows ?? [];
  if (!rows.length) throw new Error("Nasdaq sin cadena");
  const groups = new Map<string, { unix: number; calls: LiveOption[]; puts: LiveOption[] }>();
  let current: { iso: string; unix: number } | null = null;
  for (const row of rows) {
    if (row.expirygroup) current = parseExpiryGroup(row.expirygroup);
    if (!current || !row.strike) continue;
    const strike = nasdaqNum(row.strike);
    if (!strike) continue;
    const bucket = groups.get(current.iso) ?? { unix: current.unix, calls: [], puts: [] };
    const call = mapLeg(
      "call",
      {
        strike,
        bid: nasdaqNum(row.c_Bid),
        ask: nasdaqNum(row.c_Ask),
        lastPrice: nasdaqNum(row.c_Last),
        volume: nasdaqNum(row.c_Volume),
        openInterest: nasdaqNum(row.c_Openinterest),
      },
      current.unix,
    );
    const put = mapLeg(
      "put",
      {
        strike,
        bid: nasdaqNum(row.p_Bid),
        ask: nasdaqNum(row.p_Ask),
        lastPrice: nasdaqNum(row.p_Last),
        volume: nasdaqNum(row.p_Volume),
        openInterest: nasdaqNum(row.p_Openinterest),
      },
      current.unix,
    );
    if (call) bucket.calls.push(call);
    if (put) bucket.puts.push(put);
    groups.set(current.iso, bucket);
  }
  if (!groups.size) throw new Error("Nasdaq cadena vacía");
  const now = Date.now() / 1000;
  const minDays = Math.max(0.75, dteMin - 0.4);
  const all = [...groups.values()]
    .map((g) => ({ ...g, days: (g.unix - now) / 86400 }))
    .filter((g) => g.days >= minDays)
    .sort((a, b) => a.days - b.days);
  const inWindow = all.filter((g) => g.days <= dteMax + 0.6);
  const use = (inWindow.length ? inWindow : all).slice(0, 4);
  if (!use.length) throw new Error("Sin vencimiento en ese rango");
  const calls = use.flatMap((g) => g.calls);
  const puts = use.flatMap((g) => g.puts);
  if (calls.length + puts.length === 0) throw new Error("Nasdaq cadena vacía");
  const chosen = use[0];
  const trade = nasdaqNum((body.data?.lastTrade ?? "").match(/\$[0-9,.]+/)?.[0]);
  return {
    symbol: sym,
    name: sym,
    price: trade,
    expiration: unixToIso(chosen.unix),
    expirationUnix: chosen.unix,
    dte: Math.max(1, Math.round(chosen.days)),
    calls,
    puts,
  };
}

function mapLeg(side: "call" | "put", row: YahooOption, expUnix: number): LiveOption | null {
  const strike = Number(row.strike);
  const bid = Number(row.bid);
  const ask = Number(row.ask);
  const last = Number(row.lastPrice);
  if (!Number.isFinite(strike)) return null;
  if (!(bid > 0 || ask > 0 || last > 0)) return null;
  return {
    side,
    strike,
    bid: bid > 0 ? bid : last,
    ask: ask > 0 ? ask : last,
    last: last > 0 ? last : (bid + ask) / 2,
    volume: Number(row.volume) || 0,
    openInterest: Number(row.openInterest) || 0,
    iv: Number(row.impliedVolatility) || 0,
    expiration: unixToIso(expUnix),
    expirationUnix: expUnix,
  };
}

function parseOcc(root: string, occ: string) {
  const u = occ.toUpperCase();
  const r = root.toUpperCase();
  const rest = u.startsWith(r) ? u.slice(r.length) : u.replace(/^[A-Z]+/, "");
  const m = rest.match(/^(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!m) return null;
  const unix = Math.floor(Date.UTC(2000 + Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 1000);
  return {
    unix,
    iso: unixToIso(unix),
    side: (m[4] === "P" ? "put" : "call") as "call" | "put",
    strike: Number(m[5]) / 1000,
  };
}

type CboeQuote = {
  data?: {
    current_price?: number;
    close?: number;
    last?: number;
    options?: Array<{
      option?: string;
      bid?: number;
      ask?: number;
      last_trade_price?: number;
      last?: number;
      volume?: number;
      open_interest?: number;
      iv?: number;
      implied_volatility?: number;
    }>;
  };
};

async function fetchCboeOptions(sym: string, dteMin: number, dteMax: number): Promise<LiveChain> {
  const body = await jsonGet<CboeQuote>(
    `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(sym)}.json`,
  );
  const rows = body.data?.options ?? [];
  if (!rows.length) throw new Error("CBOE cadena vacía");
  const now = Date.now() / 1000;
  const minDays = Math.max(0.75, dteMin - 0.4);
  const calls: LiveOption[] = [];
  const puts: LiveOption[] = [];
  const expiries = new Set<number>();
  for (const row of rows) {
    if (!row.option) continue;
    const occ = parseOcc(sym, row.option);
    if (!occ) continue;
    const days = (occ.unix - now) / 86400;
    if (days < minDays || days > dteMax + 0.6) continue;
    expiries.add(occ.unix);
    const bid = Number(row.bid) || 0;
    const ask = Number(row.ask) || 0;
    const last = Number(row.last_trade_price ?? row.last) || 0;
    if (!(bid > 0 || ask > 0 || last > 0)) continue;
    const leg: LiveOption = {
      side: occ.side,
      strike: occ.strike,
      bid: bid > 0 ? bid : last,
      ask: ask > 0 ? ask : last,
      last: last > 0 ? last : (bid + ask) / 2,
      volume: Number(row.volume) || 0,
      openInterest: Number(row.open_interest) || 0,
      iv: Number(row.iv ?? row.implied_volatility) || 0,
      expiration: occ.iso,
      expirationUnix: occ.unix,
    };
    (occ.side === "call" ? calls : puts).push(leg);
  }
  if (!calls.length && !puts.length) throw new Error("CBOE sin contratos en rango");
  const wanted = pickExpiration([...expiries], dteMin, dteMax);
  const price = Number(body.data?.current_price ?? body.data?.close ?? body.data?.last) || 0;
  return {
    symbol: sym,
    name: sym,
    price,
    expiration: unixToIso(wanted),
    expirationUnix: wanted,
    dte: Math.max(1, Math.round((wanted - now) / 86400)),
    calls,
    puts,
  };
}

async function fetchYahooOptions(sym: string, dteMin: number, dteMax: number): Promise<LiveChain> {
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}`,
    `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}`,
  ];
  let first: YahooOptions | null = null;
  for (const url of urls) {
    try {
      first = await jsonGet<YahooOptions>(url);
      if (first.optionChain?.result?.[0]?.expirationDates?.length) break;
    } catch {
      first = null;
    }
  }
  const head = first?.optionChain?.result?.[0];
  const dates = head?.expirationDates ?? [];
  if (!head || dates.length === 0) throw new Error("Sin cadena");
  const wanted = pickExpiration(dates, dteMin, dteMax);
  let pack = head.options?.[0];
  if (!pack || pack.expirationDate !== wanted) {
    const second = await jsonGet<YahooOptions>(
      `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(sym)}?date=${wanted}`,
    );
    pack = second.optionChain?.result?.[0]?.options?.[0];
  }
  if (!pack?.expirationDate) throw new Error("Sin vencimiento");
  const expUnix = pack.expirationDate;
  const calls = (pack.calls ?? [])
    .map((row) => mapLeg("call", row, expUnix))
    .filter((row): row is LiveOption => Boolean(row));
  const puts = (pack.puts ?? [])
    .map((row) => mapLeg("put", row, expUnix))
    .filter((row): row is LiveOption => Boolean(row));
  if (calls.length + puts.length === 0) throw new Error("Cadena vacía");
  const price = Number(head.quote?.regularMarketPrice) || 0;
  const now = Date.now() / 1000;
  return {
    symbol: sym,
    name: head.quote?.shortName || sym,
    price,
    expiration: unixToIso(expUnix),
    expirationUnix: expUnix,
    dte: Math.max(0, Math.round((expUnix - now) / 86400)),
    calls,
    puts,
  };
}

export async function fetchOptionChain(
  symbol: string,
  dteMin: number,
  dteMax: number,
): Promise<LiveChain> {
  const sym = symbol.toUpperCase();
  const key = `opt:${sym}:${dteMin}:${dteMax}`;
  const fresh = cached<LiveChain>(key, 90_000);
  if (fresh) return fresh;

  const loaders = [fetchNasdaqOptions, fetchCboeOptions, fetchYahooOptions];
  for (const load of loaders) {
    try {
      return remember(key, await load(sym, dteMin, dteMax));
    } catch {
      /* next source */
    }
  }

  const old = stale<LiveChain>(key, 20 * 60_000);
  if (old) return old;
  throw new Error("Sin cadena");
}

export async function fetchHotUnderlyings(): Promise<string[]> {
  const hit = cached<string[]>("hot-underlyings", 180_000);
  if (hit?.length) return hit;
  const seen = new Set<string>();
  const out: string[] = [];
  const skip = new Set(["SPX", "NDX", "RUT", "VIX", "DJX", "OEX", "XSP", "SPCX", "VIXW"]);

  const push = (raw: string) => {
    const s = raw.toUpperCase().replace(/[^A-Z]/g, "");
    if (!s || s.length > 5 || skip.has(s) || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  const scrapeYahoo = async (url: string) => {
    const html = await fetchHtml(url);
    if (!html) return;
    for (const m of html.matchAll(/data-symbol="([A-Z]{1,5})"/g)) push(m[1]);
    for (const m of html.matchAll(/"symbol":"([A-Z]{1,5})"/g)) push(m[1]);
    for (const m of html.matchAll(/\b([A-Z]{1,6})\d{6}[CP]\d{8}\b/g)) push(m[1]);
  };

  for (const url of [
    "https://finance.yahoo.com/markets/options/most-active/",
    "https://finance.yahoo.com/markets/options/highest-open-interest/",
    "https://finance.yahoo.com/markets/options/highest-implied-volatility/",
  ]) {
    try {
      await scrapeYahoo(url);
    } catch {
      /* next page */
    }
  }

  for (const core of SCAN_SYMBOLS) push(core);
  for (const core of ["SPY", "QQQ", "IWM", "NVDA", "TSLA"]) push(core);

  return remember("hot-underlyings", out.slice(0, 45));
}

export async function searchSymbols(q: string): Promise<SearchHit[]> {
  const query = q.trim();
  if (query.length < 1) return [];
  const key = `search:${query.toLowerCase()}`;
  const hit = cached<SearchHit[]>(key, 180_000);
  if (hit) return hit;
  try {
    const data = await nasdaqJson<LookupPayload>(
      `https://api.nasdaq.com/api/autocomplete/slookup/8?search=${encodeURIComponent(query)}`,
    );
    const hits = (data.data ?? [])
      .filter((row) => row.symbol)
      .slice(0, 8)
      .map((row) => ({
        symbol: row.symbol as string,
        name: row.name || (row.symbol as string),
        type: row.asset || "",
        exchange: row.exchange || "",
      }));
    return remember(key, hits);
  } catch {
    return [];
  }
}

export const INDEX_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "DIA", label: "Dow" },
  { symbol: "QQQ", label: "Nasdaq" },
  { symbol: "IWM", label: "Russell" },
  { symbol: "^VIX", label: "VIX" },
] as const;

export const RADAR_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "TSLA"];
