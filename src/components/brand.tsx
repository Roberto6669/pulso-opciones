import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const APP_VERSION = "WEB5.0 - V3.9";
export const BRAND_NAME = "Roberto Escobar Citty";
export const PRODUCT_NAME = "Pulso Options Analyzer";
export const BRAND_ROLE = "Regional Vice President · Options Analysis Dashboard";

export function BrandLockup({
  version = APP_VERSION,
  compact = false,
}: {
  version?: string;
  compact?: boolean;
}) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2 text-fg">
      <span
        className={cn(
          "grid shrink-0 place-items-center border border-line-strong bg-raised font-sans font-semibold tracking-tight text-accent",
          compact ? "size-6 text-[9px]" : "size-7 text-[10px]",
        )}
      >
        RE
      </span>
      <span className="min-w-0">
        <span className="hidden text-[11px] font-semibold tracking-[0.1em] uppercase sm:block">
          {BRAND_NAME}
        </span>
        <span className="block text-[11px] font-semibold tracking-[0.08em] uppercase sm:hidden">
          REC
        </span>
        <span className="hidden text-[10px] text-muted sm:block">
          {compact ? PRODUCT_NAME : BRAND_ROLE}
        </span>
      </span>
      <span className="bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-fg">
        {version}
      </span>
    </Link>
  );
}
