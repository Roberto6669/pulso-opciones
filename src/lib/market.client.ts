async function post<T>(op: string, extra: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/market", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, ...extra }),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const err = body && typeof body === "object" && "error" in body ? String((body as { error: string }).error) : text;
    throw new Error(err || `HTTP ${res.status}`);
  }
  return body as T;
}

export const marketApi = {
  indices: () => post("indices"),
  hot: () => post<{ symbols: string[] }>("hot"),
  scan: (data: {
    symbols: string[];
    side: string;
    budget: number;
    dteMin: number;
    dteMax: number;
    largeCap?: boolean;
  }) => post("scan", data),
  equities: (data: { symbols: string[]; largeCap?: boolean }) => post("equities", data),
  analyze: (data: { symbol: string; range?: string }) => post("analyze", data),
};
