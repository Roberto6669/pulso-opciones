import { cn } from "@/lib/utils";

export function ScoreBar({
  score,
  label = "SCORE SETUP",
  hint,
}: {
  score: number;
  label?: string;
  hint?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className="shrink-0 font-mono text-sm tabular-nums">
        {Math.round(clamped)}
        <span className="ml-1.5 text-[9px] tracking-[0.12em] text-subtle">{label}</span>
      </p>
      <div className="relative h-1.5 min-w-0 flex-1 bg-gradient-to-r from-down via-wait to-up">
        <span
          className="absolute -top-1 size-0 -translate-x-1/2 border-x-[3px] border-t-[5px] border-x-transparent border-t-fg"
          style={{ left: `${clamped}%` }}
        />
      </div>
      {hint && <p className="hidden shrink-0 text-[10px] text-muted lg:block">{hint}</p>}
    </div>
  );
}

export function MiniScore({ score }: { score: number }) {
  const tone = score >= 70 ? "text-up" : score >= 50 ? "text-wait" : "text-down";
  return (
    <span className={cn("font-mono text-xs tabular-nums", tone)}>{Math.round(score)}</span>
  );
}
