import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export const listWatch = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ symbol: string }>`
      select symbol from watchlist
      where user_id = ${context.userId}
      order by created_at desc
    `;
  });

export const addWatch = createServerFn({ method: "POST" })
  .validator((symbol: string) =>
    String(symbol ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 16),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data: symbol }) => {
    if (!symbol) return;
    const sql = await getSql();
    await sql`
      insert into watchlist (user_id, symbol)
      values (${context.userId}, ${symbol})
      on conflict (user_id, symbol) do nothing
    `;
  });

export const removeWatch = createServerFn({ method: "POST" })
  .validator((symbol: string) =>
    String(symbol ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 16),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data: symbol }) => {
    const sql = await getSql();
    await sql`
      delete from watchlist
      where user_id = ${context.userId} and symbol = ${symbol}
    `;
  });
