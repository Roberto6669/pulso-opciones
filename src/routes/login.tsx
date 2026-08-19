import { BrandLockup } from "@/components/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm space-y-6 border border-line bg-surface p-6">
        <BrandLockup />
        <div>
          <h1 className="text-lg font-medium">Entra para guardar tu lista</h1>
          <p className="mt-1 text-sm text-muted">
            El análisis funciona sin cuenta. La watchlist es tuya.
          </p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continuar con {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">El acceso está desactivado.</p>
        )}
        <Link to="/" className="inline-block text-sm text-muted hover:text-fg">
          Volver al escáner
        </Link>
      </div>
    </main>
  );
}
