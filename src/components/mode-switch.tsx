import { cn } from "@/lib/utils";
import { type MarketMode, modeLabel } from "@/lib/equity";

const MODES: MarketMode[] = ["options", "stocks", "etf"];

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: MarketMode;
  onChange: (mode: MarketMode) => void;
}) {
  return (
    <div className="flex shrink-0 border border-line">
      {MODES.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "h-7 px-2 text-[10px] tracking-[0.08em] uppercase sm:px-2.5",
            mode === id ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg",
          )}
        >
          {modeLabel(id)}
        </button>
      ))}
    </div>
  );
}
