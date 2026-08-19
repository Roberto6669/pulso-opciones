import { cn } from "@/lib/utils";
import { type MarketMode, modeLabel } from "@/lib/equity";

const MODES: MarketMode[] = ["options", "stocks", "etf"];

export function ModeSwitch({
  mode,
  onChange,
  className,
}: {
  mode: MarketMode;
  onChange: (mode: MarketMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 border border-line", className)}>
      {MODES.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "h-7 min-w-0 flex-1 px-2 text-[10px] tracking-[0.08em] uppercase sm:flex-none sm:px-2.5",
            mode === id ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg",
          )}
        >
          {modeLabel(id)}
        </button>
      ))}
    </div>
  );
}
