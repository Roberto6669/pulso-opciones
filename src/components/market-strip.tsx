import { useEffect, useState } from "react";
import { MiniChart } from "@/components/mini-chart";
import { marketApi } from "@/lib/market.client";
import type { IndexQuote } from "@/lib/market.fns";
import { cn, formatMoney, formatPct } from "@/lib/utils";

function marketClock() {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  const open = day >= 1 && day <= 5 && mins >= 9 * 60 + 30 && mins < 16 * 60;
  return {
    label: et.toLocaleTimeString("es-US", { hour: "numeric", minute: "2-digit" }),
    open,
  };
}

export function MarketStrip() {
  const [rows, setRows] = useState<IndexQuote[]>([]);
  const [clock, setClock] = useState(marketClock);

  useEffect(() => {
    void marketApi
      .indices()
      .then((rows) => setRows(rows as IndexQuote[]))
      .catch(() => setRows([]));
    const id = window.setInterval(() => setClock(marketClock()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="border-b border-line bg-surface">
      <div className="flex overflow-x-auto divide-x divide-line lg:grid lg:grid-cols-5">
        {(rows.length ? rows : fallback).map((row) => (
          <div key={row.label} className="flex min-w-[42%] items-center justify-between gap-2 px-2 py-1 lg:min-w-0">
            <div className="min-w-0">
              <p className="text-[9px] tracking-[0.12em] text-subtle uppercase">{row.label}</p>
              <p className="font-mono text-[11px] tabular-nums">
                {row.price ? formatMoney(row.price) : "—"}{" "}
                <span className={cn("text-xs", row.changePct >= 0 ? "text-up" : "text-down")}>
                  {row.price ? formatPct(row.changePct) : ""}
                </span>
              </p>
            </div>
            <MiniChart points={row.spark ?? []} up={row.changePct >= 0} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-2.5 py-1 text-[10px] text-muted">
        <p>
          Hora {clock.label} ET ·{" "}
          {clock.open ? (
            <span className="text-up">EN LÍNEA</span>
          ) : (
            <span className="text-down">CERRADO</span>
          )}
        </p>
        <p>Precios de referencia. Confírmalos al abrir.</p>
      </div>
    </div>
  );
}

const fallback: IndexQuote[] = [
  { symbol: "SPY", label: "S&P 500", price: 0, changePct: 0, spark: [] },
  { symbol: "DIA", label: "Dow", price: 0, changePct: 0, spark: [] },
  { symbol: "QQQ", label: "Nasdaq", price: 0, changePct: 0, spark: [] },
  { symbol: "IWM", label: "Russell", price: 0, changePct: 0, spark: [] },
  { symbol: "^VIX", label: "VIX", price: 0, changePct: 0, spark: [] },
];
