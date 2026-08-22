import { Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { formatMoney } from "@/lib/utils";

type Point = { spot: number; pnl: number };

export function PayoffChart({
  points,
  spot,
  breakeven,
}: {
  points: Point[];
  spot: number;
  breakeven: number;
}) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="spot"
            tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoney(Number(v))}
          />
          <YAxis
            width={52}
            tick={{ fill: "var(--color-subtle)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoney(Number(v))}
          />
          <ReferenceLine y={0} stroke="var(--color-line-strong)" />
          <ReferenceLine x={spot} stroke="var(--color-muted)" strokeDasharray="3 3" />
          <ReferenceLine x={breakeven} stroke="var(--color-accent)" strokeDasharray="4 3" />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              color: "var(--color-fg)",
            }}
            formatter={(v) => [formatMoney(Number(v)), "P&L"]}
            labelFormatter={(v) => `Spot ${formatMoney(Number(v))}`}
          />
          <Line type="monotone" dataKey="pnl" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
