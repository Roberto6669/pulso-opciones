import { Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { formatMoney } from "@/lib/utils";

type Point = { spot: number; pnl: number };

export function PayoffChart({
  points,
  spot,
  breakeven,
  emLow,
  emHigh,
}: {
  points: Point[];
  spot: number;
  breakeven: number;
  emLow?: number;
  emHigh?: number;
}) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="spot"
            tick={{ fill: "var(--color-subtle)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoney(Number(v))}
          />
          <YAxis
            width={48}
            tick={{ fill: "var(--color-subtle)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoney(Number(v))}
          />
          <ReferenceLine y={0} stroke="var(--color-line-strong)" strokeWidth={1} />
          <ReferenceLine x={spot} stroke="var(--color-muted)" strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine
            x={breakeven}
            stroke="var(--color-accent)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: "BE", position: "insideTopRight", fill: "var(--color-accent)", fontSize: 9 }}
          />
          {emLow != null && emLow > 0 && (
            <ReferenceLine
              x={emLow}
              stroke="var(--color-wait)"
              strokeDasharray="2 3"
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          )}
          {emHigh != null && (
            <ReferenceLine
              x={emHigh}
              stroke="var(--color-wait)"
              strokeDasharray="2 3"
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 0,
              color: "var(--color-fg)",
              fontSize: 11,
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
