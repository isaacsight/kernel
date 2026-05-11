import {
  POLYMARKET_GAMMA_BASE,
  type PolymarketOutcome,
  type PolymarketError,
} from "./types.js";

/** Low-level Gamma HTTP client. Returns discriminated unions; never throws. */
export async function gammaGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  options: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<PolymarketOutcome<T>> {
  const base = options.baseUrl ?? POLYMARKET_GAMMA_BASE;
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, base + "/");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "kbot-finance/0.1" },
      signal: controller.signal,
    });
    if (res.status === 404) {
      return err({ code: "not_found", message: `404 ${url.pathname}`, status: 404 });
    }
    if (res.status === 429) {
      return err({ code: "rate_limited", message: "429 from Gamma", status: 429 });
    }
    if (!res.ok) {
      const body = await safeText(res);
      return err({ code: "http", message: `HTTP ${res.status}`, status: res.status, body });
    }
    try {
      const value = (await res.json()) as T;
      return { ok: true, value };
    } catch (parseErr) {
      return err({
        code: "parse",
        message: `JSON parse failed: ${(parseErr as Error).message}`,
      });
    }
  } catch (netErr) {
    return err({ code: "network", message: (netErr as Error).message });
  } finally {
    clearTimeout(timeout);
  }
}

function err(error: PolymarketError): PolymarketOutcome<never> {
  return { ok: false, error };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 512);
  } catch {
    return "";
  }
}
