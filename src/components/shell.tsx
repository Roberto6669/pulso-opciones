import { Link } from "@tanstack/react-router";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { APP_VERSION, BrandLockup } from "@/components/brand";
import { MarketStrip } from "@/components/market-strip";
import { ModeSwitch } from "@/components/mode-switch";
import type { MarketMode } from "@/lib/equity";

export function Shell({
  children,
  version = APP_VERSION,
  mode,
  onMode,
}: {
  children: React.ReactNode;
  version?: string;
  mode?: MarketMode;
  onMode?: (mode: MarketMode) => void;
}) {
  const { isPending } = useCurrentUserState();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-line bg-surface">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-3">
          <BrandLockup version={version} />
          {mode && onMode && <ModeSwitch mode={mode} onChange={onMode} />}
          <div className="flex shrink-0 items-center gap-2 text-sm">
            {isPending ? (
              <div className="h-7 w-12 bg-raised" />
            ) : (
              <>
                <SignedOut>
                  <Link
                    to="/login"
                    className="inline-flex h-7 items-center border border-line px-2 text-[11px] hover:bg-raised"
                  >
                    Entrar
                  </Link>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </>
            )}
          </div>
        </div>
      </header>
      <MarketStrip />
      {children}
      <footer className="hidden border-t border-line bg-surface lg:block">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <BrandLockup version={version} compact />
          <p className="text-[10px] text-subtle">
            Análisis técnico. No es consejo de inversión.
          </p>
        </div>
      </footer>
    </div>
  );
}
