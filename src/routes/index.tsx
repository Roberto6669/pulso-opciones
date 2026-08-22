import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceChart } from "@/components/price-chart";
import { EstimatePanel } from "@/components/estimate-panel";
import { OptionCalc } from "@/components/option-calc";
import { MiniChart } from "@/components/mini-chart";
import { PlainWhy } from "@/components/plain-why";
import { OptionTicket } from "@/components/option-ticket";
import { EquityTicket } from "@/components/equity-ticket";
import { ScoreBar, MiniScore } from "@/components/score-bar";
import { APP_VERSION } from "@/components/brand";
import { analyzeTicker, fetchHotUniverse, scanBatch, scanEquities, type PublicAnalysis } from "@/lib/market.fns";
import type { SparkPoint } from "@/lib/analysis";
import { estimatePayoff } from "@/lib/estimate";
import { actionFor, confidenceLabel, dteRisk, setupTags } from "@/lib/setup";
import { cn, formatMoney, formatPct } from "@/lib/utils";
import {
  ETF_SYMBOLS,
  STOCK_SYMBOLS,
  estimateEquity,
  type EquityHit,
  type MarketMode,
} from "@/lib/equity";
import {
  dte,
  iso,
  nextFriday,
  parseSymbols,
  SCAN_SYMBOLS,
  BUDGET_TIERS,
  optionFlow,
  type Ranked,
  type Side,
} from "@/lib/scan";

export const Route = createFileRoute("/")({
  component: Home,
});

const BUDGETS = [25, 50, 100, 250, 500, 1000] as const;

function bandTone(tier: number) {
  if (tier <= 25) return "border-l-up text-up";
  if (tier <= 50) return "border-l-accent text-accent";
  if (tier <= 100) return "border-l-wait text-wait";
  if (tier <= 250) return "border-l-sma50 text-sma50";
  if (tier <= 500) return "border-l-bb text-bb";
  return "border-l-muted text-muted";
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}

function Home() {
  const [mode, setMode] = useState<MarketMode>("options");
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]>(100);
  const [symbols, setSymbols] = useState("");
  const [side, setSide] = useState<Side>("both");
  const [dteMin, setDteMin] = useState(1);
  const [dteMax, setDteMax] = useState(7);
  const [exp, setExp] = useState(() => iso(nextFriday()));
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<Ranked[]>([]);
  const [auto, setAuto] = useState(true);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [omitted, setOmitted] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [chartOpen, setChartOpen] = useState(false);
  const [picked, setPicked] = useState<Ranked | null>(null);
  const [analysis, setAnalysis] = useState<PublicAnalysis | null>(null);
  const [chartBusy, setChartBusy] = useState(false);
  const [chartErr, setChartErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [eqHits, setEqHits] = useState<EquityHit[]>([]);
  const [pickedEq, setPickedEq] = useState<EquityHit | null>(null);
  const [minis, setMinis] = useState<Record<string, SparkPoint[]>>({});
  const scanId = useRef(0);
  const isOptions = mode === "options";

  const days = picked?.exp ? dte(picked.exp) : dte(exp);
  const filterDays = Math.max(dteMin, dteMax);
  const risk = dteRisk(filterDays);
  const friday = nextFriday();
  const hitPack = useMemo(() => {
    const flow = (h: Ranked) => optionFlow(h.vol, h.oi);
    const useful = (h: Ranked, cap: number) =>
      h.debit <= cap && (h.vol > 0 || h.oi > 10);
    const unique = (rows: Ranked[]) => {
      const seen = new Set<string>();
      return rows.filter((h) => {
        if (seen.has(h.s)) return false;
        seen.add(h.s);
        return true;
      });
    };
    const pickForCap = (cap: number) =>
      unique(
        hits
          .filter((h) => h.debit <= cap && useful(h, cap))
          .sort((a, b) => flow(b) - flow(a) || b.score - a.score),
      );

    let cap: number = budget;
    let pool = pickForCap(budget);
    if (pool.length === 0) {
      for (const t of BUDGET_TIERS) {
        if (t <= budget) continue;
        pool = pickForCap(t);
        if (pool.length) {
          cap = t;
          break;
        }
      }
    }

    const capIndex = BUDGET_TIERS.indexOf(cap as (typeof BUDGET_TIERS)[number]);
    const allowed = capIndex >= 0 ? BUDGET_TIERS.slice(0, capIndex + 1) : [...BUDGET_TIERS];
    const groups = allowed
      .map((tier, i) => {
        const prev = i === 0 ? 0 : allowed[i - 1];
        const rows = pool.filter((h) => h.debit > prev && h.debit <= tier);
        return { tier, yours: tier <= budget, rows };
      })
      .filter((g) => g.rows.length > 0);
    return { groups, cap, empty: pool.length === 0, cascaded: cap > budget && pool.length > 0 };
  }, [hits, budget]);
  const hitGroups = hitPack.groups;
  const visibleHits = useMemo(() => hitGroups.flatMap((g) => g.rows), [hitGroups]);
  const inBudgetHits = useMemo(
    () => visibleHits.filter((h) => h.debit <= budget + 0.009),
    [visibleHits, budget],
  );
  const best = isOptions ? (inBudgetHits[0]?.score ?? visibleHits[0]?.score ?? 0) : (eqHits[0]?.score ?? 0);
  const callN = inBudgetHits.filter((h) => h.t === "call").length;
  const putN = inBudgetHits.filter((h) => h.t === "put").length;
  const activeSymbol = isOptions ? picked?.s : pickedEq?.s;

  useEffect(() => {
    setScanned(false);
    setScanning(false);
    setHits([]);
    setEqHits([]);
    setPicked(null);
    setPickedEq(null);
    setAnalysis(null);
    setOmitted([]);
    setScanLog([]);
    setMinis({});
    setFiltersOpen(true);
    scanId.current += 1;
  }, [mode]);

  useEffect(() => {
    if (!isOptions) return;
    if (hits.length === 0) {
      if (!scanning) {
        setPicked(null);
        setAnalysis(null);
      }
      return;
    }
    const pool = hits.filter((h) => h.debit <= budget + 0.009);
    const list = pool.length ? pool : hits;
    setPicked((prev) => {
      if (prev && list.some((h) => h.s === prev.s && h.k === prev.k && h.t === prev.t && h.exp === prev.exp)) {
        return prev;
      }
      return list[0];
    });
  }, [hits, budget, isOptions, scanned, scanning]);

  useEffect(() => {
    if (isOptions) return;
    if (eqHits.length === 0) {
      if (!scanning) {
        setPickedEq(null);
        setAnalysis(null);
      }
      return;
    }
    setPickedEq((prev) => {
      if (prev && eqHits.some((h) => h.s === prev.s)) return prev;
      return eqHits[0];
    });
  }, [eqHits, isOptions, scanning]);

  useEffect(() => {
    if (!activeSymbol) return;
    let cancel = false;
    setChartBusy(true);
    setChartErr(null);
    void analyzeTicker({ data: { symbol: activeSymbol, range: "6mo" } })
      .then((row) => {
        if (!cancel) setAnalysis(row);
      })
      .catch(() => {
        if (!cancel) {
          setAnalysis(null);
          setChartErr("No pude cargar el gráfico de ese símbolo ahora.");
        }
      })
      .finally(() => {
        if (!cancel) setChartBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [activeSymbol]);

  useEffect(() => {
    if (!activeSymbol) return;
    setNote(window.localStorage.getItem(`pulso-note-${activeSymbol}`) ?? "");
  }, [activeSymbol]);

  const estimate = useMemo(() => {
    if (!picked) return null;
    const spot = analysis?.price ?? picked.px;
    return estimatePayoff(picked, spot, budget, {
      dte: days,
      closes: analysis?.series.map((p) => p.c),
      times: analysis?.series.map((p) => p.t),
      indicators: analysis?.indicators ?? null,
      bands: {
        upper: analysis?.indicators.bbUpper ?? null,
        lower: analysis?.indicators.bbLower ?? null,
      },
    });
  }, [analysis, budget, days, picked]);

  const action = estimate ? actionFor(estimate, analysis, picked ?? undefined, days) : null;
  const tags = picked ? setupTags(analysis, picked) : [];
  const eqEst = useMemo(() => {
    if (!pickedEq) return null;
    return estimateEquity(pickedEq, budget, days, analysis?.series.map((p) => p.c));
  }, [analysis, budget, days, pickedEq]);

  function universe() {
    const list = parseSymbols(symbols);
    if (list.length) return list;
    if (mode === "stocks") return STOCK_SYMBOLS;
    if (mode === "etf") return ETF_SYMBOLS;
    return SCAN_SYMBOLS;
  }

  async function runScan() {
    const id = ++scanId.current;
    let pool = universe();
    const wide = parseSymbols(symbols).length === 0;
    setAuto(wide);
    setScanning(true);
    setScanned(false);
    setHits([]);
    setEqHits([]);
    setOmitted([]);
    setMinis({});
    setScanLog(["Buscando qué se mueve hoy en opciones…"]);
    setProgress({ done: 0, total: pool.length, label: pool[0] ?? "" });
    setPicked(null);
    setPickedEq(null);
    setAnalysis(null);

    if (wide && isOptions) {
      try {
        const hot = await fetchHotUniverse({ data: true });
        if (id !== scanId.current) return;
        if (hot.symbols.length) pool = hot.symbols;
      } catch {
        /* keep SCAN_SYMBOLS */
      }
    }
    setProgress({ done: 0, total: pool.length, label: pool[0] ?? "" });
    setScanLog(
      wide && isOptions
        ? [`Volumen de opciones hoy (${pool.length}): ${pool.slice(0, 14).join(", ")}${pool.length > 14 ? "…" : ""}`]
        : [`Consultando ${pool.length} símbolo(s) en el mercado…`],
    );

    const skipped: string[] = [];
    const lines: string[] = [
      wide && isOptions
        ? `Volumen de opciones hoy (${pool.length}): ${pool.slice(0, 14).join(", ")}${pool.length > 14 ? "…" : ""}`
        : `Consultando ${pool.length} símbolo(s) en el mercado…`,
    ];
    const foundOpt: Ranked[] = [];
    const foundEq: EquityHit[] = [];
    const spark: Record<string, SparkPoint[]> = {};
    const step = isOptions ? 3 : 5;

    for (let i = 0; i < pool.length; i += step) {
      if (id !== scanId.current) return;
      const chunk = pool.slice(i, i + step);
      setProgress({ done: i, total: pool.length, label: chunk.join(" · ") });
      try {
        if (isOptions) {
          const batch = await scanBatch({
            data: {
              symbols: chunk,
              side,
              budget,
              dteMin: Math.min(dteMin, dteMax),
              dteMax: Math.max(dteMin, dteMax),
              largeCap: false,
            },
          });
          if (id !== scanId.current) return;
          foundOpt.push(...batch.hits);
          skipped.push(...batch.omitted);
          lines.push(...batch.log);
          Object.assign(spark, batch.minis);
          setHits([...foundOpt].sort((a, b) => b.score - a.score || b.vol - a.vol));
        } else {
          const batch = await scanEquities({ data: { symbols: chunk, largeCap: wide } });
          if (id !== scanId.current) return;
          foundEq.push(...batch.hits);
          skipped.push(...batch.omitted);
          lines.push(...batch.log);
          Object.assign(spark, batch.minis);
          setEqHits([...foundEq].sort((a, b) => b.score - a.score));
        }
        setMinis({ ...spark });
        setOmitted([...skipped]);
        setScanLog([...lines]);
      } catch {
        const fail = chunk.map((s) => `${s} · error de red`);
        lines.push(...fail);
        skipped.push(...chunk);
        setScanLog([...lines]);
        setOmitted([...skipped]);
      }
    }

    if (id !== scanId.current) return;
    setScanLog([
      ...lines,
      isOptions
        ? `Listo: ${foundOpt.length} contrato(s) · ${skipped.length} omitido(s).`
        : `Listo: ${foundEq.length} símbolo(s) · ${skipped.length} omitido(s).`,
    ]);
    setProgress({ done: pool.length, total: pool.length, label: "completo" });
    if (foundOpt[0]?.exp) setExp(foundOpt[0].exp);
    setScanned(true);
    setScanning(false);
    setFiltersOpen(false);
  }

  function saveNote(value: string) {
    setNote(value);
    if (activeSymbol) window.localStorage.setItem(`pulso-note-${activeSymbol}`, value);
  }

  const resultCount = isOptions ? visibleHits.length : eqHits.length;

  return (
    <Shell version={APP_VERSION} mode={mode} onMode={setMode}>
      <div className="grid items-start gap-2 p-2 lg:grid-cols-[15.5rem_minmax(0,1fr)_15.5rem]">
        <aside
          className={cn(
            "space-y-2 lg:sticky lg:top-2 lg:block",
            scanned && !filtersOpen && "hidden lg:block",
          )}
        >
          <section className="border border-line bg-surface p-2.5">
            <p className="mb-2 text-[9px] tracking-[0.14em] text-subtle uppercase">
              {isOptions ? "Presupuesto y tiempo" : "Capital y horizonte"}
            </p>
            <label className="mb-1 block text-[9px] tracking-[0.12em] text-subtle uppercase">
              {isOptions ? "Presupuesto máximo por contrato" : "Capital a invertir"}
            </label>
            <Input
              value={budget}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (BUDGETS.includes(n as (typeof BUDGETS)[number])) setBudget(n as (typeof BUDGETS)[number]);
              }}
              className="mb-1.5 h-7"
            />
            <div className="grid grid-cols-3 gap-1">
              {BUDGETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBudget(n)}
                  className={cn(
                    "h-7 border text-[10px] tabular-nums",
                    budget === n
                      ? "border-transparent bg-accent text-accent-fg"
                      : "border-line text-fg hover:bg-raised",
                  )}
                >
                  ${n.toLocaleString("en-US")}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted">
              Comisión IBKR: $0.65/contrato + ~$0.03 bolsa, mín. $1. Ida y vuelta en las ganancias.
            </p>

            <div className="mt-2 grid grid-cols-3 gap-1">
              {(
                [
                  [1, 7, "≤ 7 días"],
                  [7, 14, "14 días"],
                  [21, 45, "21–45"],
                ] as const
              ).map(([min, max, label]) => {
                const on =
                  label === "≤ 7 días" ? dteMax <= 7 : dteMin === min && dteMax === max;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setDteMin(min);
                      setDteMax(max);
                      setExp(min === 1 ? iso(nextFriday()) : addDays(Math.round((min + max) / 2)));
                    }}
                    className={cn(
                      "h-7 border text-[10px]",
                      on ? "border-transparent bg-accent text-accent-fg" : "border-line text-muted hover:text-fg",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div>
                <label className="mb-1 block text-[9px] tracking-[0.12em] text-subtle uppercase">
                  {isOptions ? "DTE mínimo" : "Días mín."}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={dteMin}
                  onChange={(e) => setDteMin(Number(e.target.value) || 1)}
                  className="h-7"
                />
              </div>
              <div>
                <label className="mb-1 block text-[9px] tracking-[0.12em] text-subtle uppercase">
                  {isOptions ? "DTE máximo" : "Días máx."}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={dteMax}
                  onChange={(e) => setDteMax(Number(e.target.value) || 1)}
                  className="h-7"
                />
              </div>
            </div>
            {isOptions && (
              <button
                type="button"
                onClick={() => {
                  const f = nextFriday();
                  setExp(iso(f));
                  setDteMin(1);
                  setDteMax(Math.max(1, dte(iso(f))));
                }}
                className="mt-2 flex h-11 w-full flex-col items-center justify-center border border-accent bg-accent/15 text-[13px] font-semibold tracking-wide text-accent hover:bg-accent/25"
              >
                Próximo viernes
                <span className="mt-0.5 text-[10px] font-normal text-fg/80">
                  {friday.toLocaleDateString("es-US", { weekday: "short", day: "numeric", month: "short" })} · {dte(iso(friday))} días
                </span>
              </button>
            )}

            <div className="mt-2">
              <div className="h-1 overflow-hidden bg-raised">
                <div
                  className={cn(
                    "h-full",
                    risk.tone === "up" && "bg-up",
                    risk.tone === "wait" && "bg-wait",
                    risk.tone === "down" && "bg-down",
                  )}
                  style={{ width: `${Math.min(100, (filterDays / 60) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted">
                Filtro {dteMin}–{dteMax} {isOptions ? "DTE" : "días"} · {risk.label}
              </p>
            </div>

            {isOptions && dteMax <= 7 && (
              <p className="mt-1.5 text-[10px] leading-snug text-down">
                1–7 días: muy agresivo. El contrato pierde valor por tiempo con mucha rapidez.
              </p>
            )}
            {isOptions && budget <= 25 && (
              <p className="mt-1.5 text-[10px] leading-snug text-wait">
                Prima máxima $25: solo entran weeklies baratas (≈0.25 o menos).
              </p>
            )}

            <Button type="button" className="mt-2 h-8 w-full" disabled={scanning} onClick={() => void runScan()}>
              {scanning
                ? `Buscando ${progress.done}/${progress.total}…`
                : isOptions
                  ? dteMax <= 7
                    ? "Buscar weeklies (≤7 días)"
                    : "Buscar las mejores ahora"
                  : mode === "etf"
                    ? "Buscar ETFs"
                    : "Buscar acciones"}
            </Button>
            {scanning && (
              <div className="mt-2">
                <div className="h-1 bg-raised">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 6}%` }}
                  />
                </div>
                <p className="mt-1 truncate text-[10px] text-muted">{progress.label}</p>
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-subtle">
              {isOptions
                ? "Vacío = más volumen de OPCIONES hoy, no las acciones más negociadas."
                : `Vacío: ${universe().length} large caps / ETFs líquidos.`}
            </p>
          </section>

          <section className="border border-line bg-surface p-2.5">
            <p className="mb-1.5 text-[9px] tracking-[0.14em] text-subtle uppercase">Qué analizar</p>
            <textarea
              value={symbols}
              onChange={(e) => setSymbols(e.target.value.toUpperCase())}
              placeholder={
                mode === "etf"
                  ? "SPY, QQQ, XLK…"
                  : "Vacío = más volumen de OPCIONES hoy (como IBKR Option Volume)"
              }
              rows={3}
              autoCorrect="off"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              lang="en"
              enterKeyHint="done"
              data-gramm="false"
              className="w-full border border-line bg-raised px-2 py-1.5 font-mono text-xs uppercase outline-none focus:border-accent/50"
            />
            {isOptions && (
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {(
                  [
                    ["both", "AUTO"],
                    ["call", "CALLS"],
                    ["put", "PUTS"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSide(id)}
                    className={cn(
                      "h-7 border text-[10px]",
                      side === id
                        ? "border-transparent bg-accent text-accent-fg"
                        : "border-line text-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main className="min-w-0 space-y-2">
          <div className="flex items-center gap-1 lg:hidden">
            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">
              ${budget} · {dteMin}–{dteMax}d
              {isOptions ? ` · ${side === "both" ? "AUTO" : side.toUpperCase()}` : mode === "etf" ? " · ETF" : " · ACCIONES"}
            </p>
            <button
              type="button"
              className="h-7 border border-line px-2 text-[10px]"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filtros
            </button>
            <Button type="button" size="sm" disabled={scanning} onClick={() => void runScan()}>
              {scanning ? `${progress.done}/${progress.total}` : "Buscar"}
            </Button>
          </div>

          {isOptions && picked && estimate && (
            <div className="sticky top-0 z-20 lg:hidden">
              <OptionTicket
                contract={picked}
                estimate={estimate}
                analysis={analysis}
                dte={picked.exp ? dte(picked.exp) : days}
                action={action?.label}
              />
            </div>
          )}
          {!isOptions && pickedEq && eqEst && (
            <div className="sticky top-0 z-20 lg:hidden">
              <EquityTicket hit={pickedEq} estimate={eqEst} analysis={analysis} />
            </div>
          )}

          <div className="relative hidden overflow-hidden lg:block">
            <p className="pointer-events-none absolute inset-y-0 right-0 z-0 flex items-center text-[3.25rem] font-semibold leading-none tracking-[0.12em] text-fg/[0.15] uppercase">
              {isOptions ? "OPCIONES" : mode === "etf" ? "ETF" : "ACCIONES"}
            </p>
            <div className="relative z-10">
              <h1 className="text-sm font-semibold">
                {isOptions ? "Pulso Options Analyzer" : mode === "etf" ? "Pulso ETF Scanner" : "Pulso Stock Scanner"}
              </h1>
              <p className="text-[11px] text-muted">
                {isOptions
                  ? "Setups técnicos y contratos filtrados por liquidez, costo y riesgo."
                  : "Escaneo técnico del subyacente: tendencia, RSI, bandas y movimiento esperado."}
              </p>
            </div>
          </div>

          {(scanned || scanning) && (
            <div className="hidden flex-wrap gap-x-3 gap-y-0.5 border border-line bg-surface px-2.5 py-1.5 text-[10px] uppercase tracking-wide lg:flex">
              <span>
                {scanning ? "Escaneando" : "Mejor"}{" "}
                <b className="text-fg">{scanning ? `${progress.done}/${progress.total}` : `${best || "—"}/100`}</b>
              </span>
              <span>
                {isOptions ? "Contratos" : "Símbolos"} <b className="text-fg">{resultCount}</b>
              </span>
              {isOptions && (
                <>
                  <span>
                    Calls <b className="text-up">{callN}</b>
                  </span>
                  <span>
                    Puts <b className="text-down">{putN}</b>
                  </span>
                </>
              )}
              <span className="text-subtle">
                {auto ? "Large cap · +1.5M vol." : "Filtro de símbolos"}
              </span>
            </div>
          )}

          {isOptions && dteMax <= 7 && scanned && (
            <div className="border border-wait/40 bg-wait/10 px-2.5 py-1.5 text-[11px] text-wait">
              Comprar opciones de pocos días con poco dinero casi nunca es un “sí”. SÍ = el salto cabe en un
              día normal. NO = queda demasiado lejos (lotería). Prueba $100 o 14 días si quieres más chance.
            </div>
          )}

          {omitted.length > 0 && (
            <div className="border border-down/40 bg-down/10 px-2.5 py-1.5 text-[11px] text-down">
              {omitted.length} símbolo(s) omitido(s): {omitted.join(", ")}.
            </div>
          )}

          {!scanned && !scanning ? (
            <div className="border border-line bg-surface p-3 text-[11px] text-muted">
              Pulsa <span className="text-fg">Buscar</span>.{" "}
              {isOptions
                ? "Pide precio y cadena de opciones de cada símbolo."
                : "Pide precio e indicadores de cada símbolo."}
            </div>
          ) : null}

          {(scanning || scanLog.length > 0) && (
            <div className="border border-line bg-surface px-2.5 py-1.5 lg:py-2">
              <p className="truncate font-mono text-[10px] text-muted">
                {scanLog[scanLog.length - 1]}
              </p>
              <ul className="mt-1 hidden max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-muted lg:block">
                {scanLog.slice(-12).map((line, i) => (
                  <li key={`${i}-${line}`}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {scanned && isOptions && hitPack.empty && !scanning ? (
            <div className="border border-down/40 bg-down/10 p-2.5 text-[11px] text-down">
              No hay nada que sirva ahora con este presupuesto y tiempo.
            </div>
          ) : null}

          {scanned && resultCount === 0 && !scanning && !isOptions ? (
            <div className="border border-down/40 bg-down/10 p-2.5 text-[11px] text-down">
              Nada entra en ese filtro.
            </div>
          ) : null}

          {isOptions && hitPack.cascaded && !scanning ? (
            <div className="border border-wait/40 bg-wait/10 p-2.5 text-[11px] text-wait">
              Nada útil en ${budget}. Esto es lo que sí sirve desde ${hitPack.cap}.
            </div>
          ) : null}

          {isOptions && visibleHits.length > 0 && (
            <div className="overflow-x-auto border border-line bg-surface">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] tracking-[0.12em] text-subtle uppercase">
                    <th className="px-2 py-1.5">Símbolo</th>
                    <th className="px-2 py-1.5">Gráfico</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell">Señal</th>
                    <th className="px-2 py-1.5">Técnico</th>
                    <th className="px-2 py-1.5">Contrato</th>
                    <th className="px-2 py-1.5">Coste</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell">Spread</th>
                    <th className="px-2 py-1.5">DTE</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {hitGroups.map((group) => (
                    <Fragment key={`band-${group.tier}`}>
                      <tr>
                        <td colSpan={9} className={cn("border-t border-line px-2 py-1.5 border-l-4", bandTone(group.tier))}>
                          <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">
                            {group.yours ? `Entran en $${group.tier}` : `Desde $${group.tier}`}
                          </span>
                          <span className="ml-2 text-[10px] text-muted">
                            {group.rows.length} símbolos · más volumen de opción
                          </span>
                        </td>
                      </tr>
                      {group.rows.map((c) => {
                    const active =
                      picked?.s === c.s && picked.t === c.t && picked.k === c.k && picked.exp === c.exp;
                    const rowDays = c.exp ? Math.max(1, dte(c.exp)) : days;
                    const rowEst = estimatePayoff(c, c.px, budget, { dte: rowDays });
                    const rowAct = actionFor(rowEst, picked?.s === c.s ? analysis : null, c, rowDays);
                    return (
                      <tr
                        key={`${c.s}-${c.t}-${c.k}-${c.exp ?? ""}`}
                        className={cn(
                          "cursor-pointer border-t border-line border-l-4",
                          bandTone(group.tier).split(" ")[0],
                          active ? "bg-raised" : "hover:bg-raised/70",
                        )}
                        onClick={() => setPicked(c)}
                      >
                        <td className="px-2 py-1.5">
                          <p className="font-medium">
                            {c.s}{" "}
                            {c.source === "live" && (
                              <span className="text-[9px] tracking-wide text-accent">LIVE</span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted">{formatMoney(c.px)}</p>
                        </td>
                        <td className="px-1 py-1">
                          <MiniChart points={minis[c.s] ?? []} up={c.trend !== "down"} />
                        </td>
                        <td className="hidden px-2 py-1.5 sm:table-cell">
                          <span className={c.t === "call" ? "text-up" : "text-down"}>
                            {c.t.toUpperCase()}
                          </span>
                          <p className="max-w-32 truncate text-[10px] text-muted">{c.why}</p>
                        </td>
                        <td className="px-2 py-1.5">
                          <MiniScore score={c.score} />
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {c.k}
                          {c.t === "call" ? "C" : "P"}
                        </td>
                        <td className="px-2 py-1.5 font-mono">{formatMoney(c.debit)}</td>
                        <td className="hidden px-2 py-1.5 font-mono sm:table-cell">{formatMoney(c.spread)}</td>
                        <td className="px-2 py-1.5 font-mono">{c.exp ? dte(c.exp) : rowDays}</td>
                        <td className="hidden px-2 py-1.5 sm:table-cell">
                          <span
                            className={cn(
                              "px-1 py-px text-[9px] tracking-wide uppercase",
                              rowAct.tone === "up" && "bg-up/15 text-up",
                              rowAct.tone === "wait" && "bg-wait/15 text-wait",
                              rowAct.tone === "down" && "bg-down/15 text-down",
                            )}
                          >
                            {rowAct.label}
                          </span>
                        </td>
                      </tr>
                    );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-2 py-1 text-[9px] text-subtle">
                Mini gráfica: línea = precio · sombra azul = Bollinger · punteado = media 20
              </p>
            </div>
          )}

          {!isOptions && eqHits.length > 0 && (
            <div className="overflow-x-auto border border-line bg-surface">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] tracking-[0.12em] text-subtle uppercase">
                    <th className="px-2 py-1.5">Símbolo</th>
                    <th className="px-2 py-1.5">Gráfico</th>
                    <th className="px-2 py-1.5">Precio</th>
                    <th className="px-2 py-1.5">Cambio</th>
                    <th className="px-2 py-1.5">Score</th>
                    <th className="px-2 py-1.5">RSI</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell">Señal</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell">HV</th>
                  </tr>
                </thead>
                <tbody>
                  {eqHits.slice(0, 16).map((row) => {
                    const active = pickedEq?.s === row.s;
                    return (
                      <tr
                        key={row.s}
                        className={cn(
                          "cursor-pointer border-t border-line",
                          active ? "bg-raised" : "hover:bg-raised/70",
                        )}
                        onClick={() => setPickedEq(row)}
                      >
                        <td className="px-2 py-1.5">
                          <p className="font-medium">{row.s}</p>
                          <p className="max-w-32 truncate text-[10px] text-muted">{row.name}</p>
                        </td>
                        <td className="px-1 py-1">
                          <MiniChart points={minis[row.s] ?? []} up={row.changePct >= 0} />
                        </td>
                        <td className="px-2 py-1.5 font-mono">{formatMoney(row.px)}</td>
                        <td className={cn("px-2 py-1.5 font-mono", row.changePct >= 0 ? "text-up" : "text-down")}>
                          {formatPct(row.changePct)}
                        </td>
                        <td className="px-2 py-1.5">
                          <MiniScore score={row.score} />
                        </td>
                        <td className="px-2 py-1.5 font-mono">{row.rsi != null ? row.rsi.toFixed(0) : "—"}</td>
                        <td className="hidden px-2 py-1.5 sm:table-cell">
                          <span
                            className={cn(
                              "px-1 py-px text-[9px] uppercase",
                              row.kind === "comprar" && "bg-up/15 text-up",
                              row.kind === "esperar" && "bg-wait/15 text-wait",
                              row.kind === "vender" && "bg-down/15 text-down",
                            )}
                          >
                            {row.kind}
                          </span>
                        </td>
                        <td className="hidden px-2 py-1.5 font-mono sm:table-cell">
                          {(row.hv * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isOptions && picked && estimate && (
            <>
              <section className="hidden border border-line bg-surface p-2.5 lg:block">
                <ScoreBar
                  score={analysis?.verdict.score ?? picked.score}
                  label="SCORE SETUP"
                  hint={`${picked.parts ? `Liq ${picked.parts.liq} · Téc ${picked.parts.tech} · Dir ${picked.parts.dir} · ` : ""}${confidenceLabel(analysis?.verdict.score ?? picked.score)}`}
                />
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {picked.s} · {formatMoney(analysis?.price ?? picked.px)}
                    </h2>
                    <p className="text-[10px] text-muted">
                      {analysis?.name ?? "Subyacente"}
                      {analysis ? ` · ${formatPct(analysis.changePct)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="border border-line px-1.5 py-px text-[9px] tracking-[0.1em] text-muted uppercase"
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </section>

              <button
                type="button"
                className="h-8 w-full border border-line bg-surface text-[11px] lg:hidden"
                onClick={() => setChartOpen((v) => !v)}
              >
                {chartOpen ? "Ocultar gráfica" : "Ver gráfica y tesis"}
              </button>

              <section className={cn("grid gap-2 xl:grid-cols-[1.2fr_0.8fr]", !chartOpen && "hidden lg:grid")}>
                <div className="border border-line bg-surface p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Gráfica · Vista general</p>
                    {chartBusy && <span className="text-[10px] text-muted">Cargando…</span>}
                  </div>
                  {chartErr && <p className="mb-1 text-[10px] text-down">{chartErr}</p>}
                  {analysis && (
                    <PriceChart
                      series={analysis.series}
                      currency={analysis.currency}
                      target={{
                        price: estimate.breakeven,
                        label: `Cierre al venc. ${picked.t.toUpperCase()} ≥ ${formatMoney(estimate.breakeven)}`,
                      }}
                      em={{ low: estimate.emLow, high: estimate.emHigh }}
                    />
                  )}
                </div>
                <div className="border border-line bg-surface p-2.5">
                  <PlainWhy
                    contract={picked}
                    estimate={estimate}
                    analysis={analysis}
                    days={days}
                    action={action ?? { label: "—", tone: "wait", detail: "" }}
                  />
                </div>
              </section>

              <div className="hidden lg:block">
                <EstimatePanel estimate={estimate} dte={days} contract={picked} analysis={analysis} />
              </div>
            </>
          )}

          {!isOptions && pickedEq && eqEst && (
            <>
              <section className="hidden border border-line bg-surface p-2.5 lg:block">
                <ScoreBar
                  score={analysis?.verdict.score ?? pickedEq.score}
                  label="SCORE TÉCNICO"
                  hint={pickedEq.kind.toUpperCase()}
                />
                <h2 className="mt-2 text-sm font-semibold">
                  {pickedEq.s} · {formatMoney(analysis?.price ?? pickedEq.px)}
                </h2>
                <p className="text-[10px] text-muted">
                  {analysis?.name ?? pickedEq.name}
                  {analysis ? ` · ${formatPct(analysis.changePct)}` : ` · ${formatPct(pickedEq.changePct)}`}
                </p>
              </section>
              <button
                type="button"
                className="h-8 w-full border border-line bg-surface text-[11px] lg:hidden"
                onClick={() => setChartOpen((v) => !v)}
              >
                {chartOpen ? "Ocultar gráfica" : "Ver gráfica"}
              </button>
              <section className={cn("border border-line bg-surface p-2", !chartOpen && "hidden lg:block")}>
                {chartErr && <p className="mb-1 text-[10px] text-down">{chartErr}</p>}
                {analysis && <PriceChart series={analysis.series} currency={analysis.currency} />}
              </section>
              <section className="hidden border border-line bg-surface lg:block">
                <div className="grid gap-px bg-line sm:grid-cols-4">
                  <div className="bg-surface px-3 py-2">
                    <p className="text-[9px] text-subtle uppercase">Capital</p>
                    <p className="font-mono text-sm">{formatMoney(eqEst.capital)}</p>
                    <p className="text-[10px] text-muted">{eqEst.shares} acciones</p>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <p className="text-[9px] text-subtle uppercase">Valor esperado</p>
                    <p className={cn("font-mono text-sm", eqEst.expectedPnl >= 0 ? "text-up" : "text-down")}>
                      {eqEst.expectedPnl >= 0 ? "+" : ""}
                      {formatMoney(eqEst.expectedPnl)}
                    </p>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <p className="text-[9px] text-subtle uppercase">Te quedarían</p>
                    <p className={cn("font-mono text-sm", eqEst.queda >= eqEst.capital ? "text-up" : "text-down")}>
                      {formatMoney(eqEst.queda)}
                    </p>
                  </div>
                  <div className="bg-surface px-3 py-2">
                    <p className="text-[9px] text-subtle uppercase">Rango ± HV</p>
                    <p className="font-mono text-sm">{eqEst.expectedMovePct.toFixed(1)}%</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>

        <aside className="hidden space-y-2 lg:sticky lg:top-2 lg:block">
          {isOptions && (
            <OptionCalc
              spot={analysis?.price ?? picked?.px ?? 100}
              strike={picked?.k ?? 100}
              dte={days}
              iv={picked?.iv || estimate?.sigma || 0.3}
              side={picked?.t ?? "call"}
              premium={picked?.mid ?? 1}
            />
          )}

          <section className="border border-line bg-surface p-2.5">
            <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Anotar esta decisión</p>
            <textarea
              value={note}
              onChange={(e) => saveNote(e.target.value)}
              rows={3}
              disabled={!activeSymbol}
              className="mt-1.5 w-full border border-line bg-raised px-2 py-1.5 text-xs outline-none disabled:opacity-40"
              placeholder="Ej: rebote en banda, espero viernes."
            />
          </section>

          <section className="border border-line bg-surface p-2.5">
            <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Métricas</p>
            {analysis || estimate || eqEst ? (
              <dl className="mt-1 space-y-1 text-xs">
                {analysis && (
                  <>
                    <Row k="RSI 14" v={analysis.indicators.rsi14?.toFixed(1) ?? "—"} />
                    <Row k="SMA 20" v={analysis.indicators.sma20 ? formatMoney(analysis.indicators.sma20) : "—"} />
                    <Row k="SMA 50" v={analysis.indicators.sma50 ? formatMoney(analysis.indicators.sma50) : "—"} />
                    <Row
                      k="Bollinger"
                      v={
                        analysis.indicators.bbLower && analysis.indicators.bbUpper
                          ? `${formatMoney(analysis.indicators.bbLower)}–${formatMoney(analysis.indicators.bbUpper)}`
                          : "—"
                      }
                    />
                  </>
                )}
                {isOptions && estimate && (
                  <>
                    <Row k="Prima pagada" v={formatMoney(estimate.capital)} tone="wait" />
                    <Row k="Comisión IBKR" v={formatMoney(estimate.feesRound)} tone="wait" />
                    <Row k="Máx. a perder" v={formatMoney(estimate.maxLoss)} />
                    <Row k="Teórico BS" v={formatMoney(estimate.fair * 100 * estimate.contracts)} />
                    <Row
                      k="Si llega la tesis"
                      v={`${estimate.targetPnl >= 0 ? "+" : ""}${formatMoney(estimate.targetPnl)}`}
                      tone={estimate.targetPnl >= 0 ? "up" : "down"}
                    />
                    <Row
                      k="Promedio modelo"
                      v={`${estimate.expectedPnl >= 0 ? "+" : ""}${formatMoney(estimate.expectedPnl)}`}
                      tone={estimate.expectedPnl >= 0 ? "up" : "down"}
                    />
                    <Row
                      k="Te quedarían (prom.)"
                      v={formatMoney(estimate.capital + estimate.expectedPnl)}
                      tone={estimate.capital + estimate.expectedPnl >= estimate.capital ? "up" : "down"}
                    />
                    <Row k="P(ganar)" v={`${(estimate.pProfit * 100).toFixed(0)}%`} />
                    <Row
                      k="EM (1σ)"
                      v={`±${formatMoney(estimate.emAbs)} (${estimate.emPct.toFixed(1)}%)`}
                    />
                    <Row k="EM alto" v={formatMoney(estimate.emHigh)} tone="up" />
                    <Row k="EM bajo" v={formatMoney(estimate.emLow)} tone="down" />
                    <Row k="Vol. hist." v={`${(estimate.hv * 100).toFixed(0)}%`} />
                  </>
                )}
                {!isOptions && eqEst && (
                  <>
                    <Row k="Capital" v={formatMoney(eqEst.capital)} tone="wait" />
                    <Row k="Comisión IBKR" v={formatMoney(eqEst.fees)} tone="wait" />
                    <Row k="Acciones" v={String(eqEst.shares)} />
                    <Row
                      k="Valor esperado"
                      v={`${eqEst.expectedPnl >= 0 ? "+" : ""}${formatMoney(eqEst.expectedPnl)}`}
                      tone={eqEst.expectedPnl >= 0 ? "up" : "down"}
                    />
                    <Row
                      k="Te quedarían"
                      v={formatMoney(eqEst.queda)}
                      tone={eqEst.queda >= eqEst.capital ? "up" : "down"}
                    />
                    <Row k="P(sube)" v={`${(eqEst.pUp * 100).toFixed(0)}%`} />
                    <Row k="Vol. hist." v={`${(eqEst.hv * 100).toFixed(0)}%`} />
                  </>
                )}
              </dl>
            ) : (
              <p className="mt-1.5 text-[10px] text-muted">Elige un símbolo para ver métricas.</p>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "up" | "down" | "wait" }) {
  return (
    <div className="flex items-start justify-between gap-2 border-t border-line pt-1">
      <dt className="text-[10px] text-subtle">{k}</dt>
      <dd
        className={cn(
          "text-right font-mono text-[11px] tabular-nums",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          tone === "wait" && "text-wait",
        )}
      >
        {v}
      </dd>
    </div>
  );
}
