import { EDGAR_SUBMISSIONS_BASE, getUserAgent, type EdgarOutcome, type EdgarError } from "./types.js";

/**
 * EDGAR HTTPS client. Returns discriminated unions; never throws across
 * the boundary. SEC requires a User-Agent that identifies the requester;
 * we send one by default and let operators override via env.
 */
export async function edgarGet<T>(
  path: string,
  options: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<EdgarOutcome<T>> {
  const base = options.baseUrl ?? EDGAR_SUBMISSIONS_BASE;
  const url = new URL(path.startsWith("/") ? path : "/" + path, base);

  const userAgent = getUserAgent();
  if (!userAgent || userAgent.trim().length === 0) {
    return err({
      code: "missing_user_agent",
      message: "Set KBOT_FINANCE_SEC_UA to a descriptive contact string per SEC fair-use policy.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
        "Accept-Encoding": "gzip, deflate",
      },
      signal: controller.signal,
    });
    if (res.status === 404) {
      return err({ code: "not_found", message: `404 ${url.pathname}`, status: 404 });
    }
    if (res.status === 429) {
      return err({ code: "rate_limited", message: "429 from EDGAR", status: 429 });
    }
    if (!res.ok) {
      return err({ code: "http", message: `HTTP ${res.status}`, status: res.status });
    }
    try {
      const value = (await res.json()) as T;
      return { ok: true, value };
    } catch (parseErr) {
      return err({ code: "parse", message: `JSON parse failed: ${(parseErr as Error).message}` });
    }
  } catch (netErr) {
    return err({ code: "network", message: (netErr as Error).message });
  } finally {
    clearTimeout(timeout);
  }
}

function err(error: EdgarError): EdgarOutcome<never> {
  return { ok: false, error };
}
