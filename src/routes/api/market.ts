import { createFileRoute } from "@tanstack/react-router";
import { analyzeBundle, loadHotUniverse, loadIndices, runEquityBatch, runScanBatch } from "@/lib/market.fns";
import { fetchChart } from "@/lib/yahoo.server";

async function readBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const Route = createFileRoute("/api/market")({
  server: {
    handlers: {
      GET: async () => Response.json(await loadIndices()),
      POST: async ({ request }) => {
        const body = await readBody(request);
        const op = String(body.op ?? "");
        try {
          if (op === "indices") return Response.json(await loadIndices());
          if (op === "hot") return Response.json(await loadHotUniverse());
          if (op === "scan") {
            const symbols = (Array.isArray(body.symbols) ? body.symbols : [])
              .map((s) => String(s).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "").slice(0, 12))
              .filter(Boolean)
              .slice(0, 6);
            return Response.json(
              await runScanBatch({
                symbols,
                side: body.side === "call" || body.side === "put" ? body.side : "both",
                budget: Math.max(10, Math.min(Number(body.budget) || 100, 5000)),
                dteMin: Math.max(1, Math.min(Number(body.dteMin) || 2, 90)),
                dteMax: Math.max(1, Math.min(Number(body.dteMax) || 7, 120)),
                largeCap: Boolean(body.largeCap),
              }),
            );
          }
          if (op === "equities") {
            const symbols = (Array.isArray(body.symbols) ? body.symbols : [])
              .map((s) => String(s).toUpperCase().replace(/[^A-Z0-9.^=-]/g, "").slice(0, 12))
              .filter(Boolean)
              .slice(0, 8);
            return Response.json(await runEquityBatch({ symbols, largeCap: Boolean(body.largeCap) }));
          }
          if (op === "analyze") {
            const symbol = String(body.symbol ?? "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9.^=-]/g, "")
              .slice(0, 16);
            if (!symbol) return Response.json({ error: "Escribe un símbolo" }, { status: 400 });
            const range = body.range === "1y" || body.range === "3mo" ? body.range : "6mo";
            const bundle = await fetchChart(symbol, range);
            return Response.json(analyzeBundle(bundle));
          }
          return Response.json({ error: "op desconocida" }, { status: 400 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
