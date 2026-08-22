import { useEffect, useMemo, useState } from "react";
import { bsGreeks, expectedMove } from "@/lib/estimate";
import { cn, formatMoney } from "@/lib/utils";

export function OptionCalc({
  spot,
  strike,
  dte,
  iv,
  side,
  premium,
}: {
  spot: number;
  strike: number;
  dte: number;
  iv: number;
  side: "call" | "put";
  premium: number;
}) {
  const [s, setS] = useState(spot);
  const [k, setK] = useState(strike);
  const [days, setDays] = useState(Math.max(1, dte));
  const [vol, setVol] = useState(Math.round(iv * 1000) / 10 || 30);
  const [kind, setKind] = useState<"call" | "put">(side);
  const [mid, setMid] = useState(premium);
  const [qty, setQty] = useState(1);
  const [target, setTarget] = useState(spot);

  useEffect(() => {
    setS(spot);
    setK(strike);
    setDays(Math.max(1, dte));
    setVol(Math.round(iv * 1000) / 10 || 30);
    setKind(side);
    setMid(premium);
    setTarget(spot);
  }, [spot, strike, dte, iv, side, premium]);

  const greeks = useMemo(() => {
    const T = Math.max(days, 1) / 365;
    const sigma = Math.max(vol / 100, 0.05);
    return bsGreeks(s, k, T, sigma, kind);
  }, [s, k, days, vol, kind]);

  const em = useMemo(() => expectedMove(s, Math.max(vol / 100, 0.05), days), [s, vol, days]);

  const pnlAt = (px: number) => {
    const value = kind === "call" ? Math.max(px - k, 0) : Math.max(k - px, 0);
    return (value - mid) * 100 * qty;
  };

  const Field = ({
    label,
    value,
    onChange,
    step = 0.01,
  }: {
    label: string;
    value: number;
    onChange: (n: number) => void;
    step?: number;
  }) => (
    <label className="block">
      <span className="text-[9px] tracking-[0.12em] text-subtle uppercase">{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 h-7 w-full border border-line bg-raised px-1.5 font-mono text-[11px] outline-none focus:border-accent/50"
      />
    </label>
  );

  return (
    <section className="border border-line bg-surface p-2.5">
      <p className="text-[9px] tracking-[0.14em] text-subtle uppercase">Calculadora de opciones</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Field label="Acción $" value={s} onChange={setS} />
        <Field label="Strike" value={k} onChange={setK} />
        <Field label="Días" value={days} onChange={setDays} step={1} />
        <Field label="IV %" value={vol} onChange={setVol} step={0.1} />
        <Field label="Prima $" value={mid} onChange={setMid} />
        <Field label="Contratos" value={qty} onChange={(n) => setQty(Math.max(1, Math.floor(n) || 1))} step={1} />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        {(["call", "put"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className={cn(
              "h-7 text-[10px] tracking-wide uppercase",
              kind === id ? (id === "call" ? "bg-up text-accent-fg" : "bg-down text-fg") : "border border-line text-muted",
            )}
          >
            {id}
          </button>
        ))}
      </div>
      <dl className="mt-2 space-y-1 text-xs">
        <CalcRow k="Teórico BS" v={formatMoney(greeks.theo)} />
        <CalcRow k="Delta" v={greeks.delta.toFixed(3)} />
        <CalcRow k="Gamma" v={greeks.gamma.toFixed(4)} />
        <CalcRow k="Theta / día" v={greeks.theta.toFixed(3)} tone="down" />
        <CalcRow k="Vega" v={greeks.vega.toFixed(3)} />
        <CalcRow
          k="EM (1σ)"
          v={`±${formatMoney(em.abs)} (${em.pct.toFixed(1)}%)`}
        />
        <CalcRow k="EM alto" v={formatMoney(em.high)} tone="up" />
        <CalcRow k="EM bajo" v={formatMoney(em.low)} tone="down" />
      </dl>
      <label className="mt-2 block">
        <span className="text-[9px] tracking-[0.12em] text-subtle uppercase">Precio objetivo al venc.</span>
        <input
          type="number"
          step={0.01}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="mt-0.5 h-7 w-full border border-line bg-raised px-1.5 font-mono text-[11px] outline-none focus:border-accent/50"
        />
      </label>
      <p
        className={cn(
          "mt-1.5 font-mono text-sm tabular-nums",
          pnlAt(target) >= 0 ? "text-up" : "text-down",
        )}
      >
        P&L al objetivo {pnlAt(target) >= 0 ? "+" : ""}
        {formatMoney(pnlAt(target))}
      </p>
      <p className="text-[10px] text-muted">
        En EM alto {formatMoney(pnlAt(em.high))} · EM bajo {formatMoney(pnlAt(em.low))}
      </p>
    </section>
  );
}

function CalcRow({ k, v, tone }: { k: string; v: string; tone?: "up" | "down" }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line pt-1">
      <dt className="text-[10px] text-subtle">{k}</dt>
      <dd className={cn("font-mono text-[11px] tabular-nums", tone === "up" && "text-up", tone === "down" && "text-down")}>
        {v}
      </dd>
    </div>
  );
}
