import {
  getAlpacaBase,
  getAlpacaCredentials,
  type AlpacaOutcome,
  type AlpacaError,
} from "./types.js";

/** Low-level Alpaca Trading API HTTP client. Returns discriminated unions; never throws. */
export async function alpacaGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  options: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<AlpacaOutcome<T>> {
  const credentials = getAlpacaCredentials();
  if (!credentials) {
    return err({
      code: "missing_credentials",
      message:
        "Set KBOT_FINANCE_ALPACA_KEY_ID + KBOT_FINANCE_ALPACA_SECRET_KEY (or APCA_API_KEY_ID + APCA_API_SECRET_KEY) — a free paper-trading key pair from alpaca.markets works.",
    });
  }

  const base = options.baseUrl ?? getAlpacaBase();
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
      headers: {
        Accept: "application/json",
        "User-Agent": "kbot-finance/0.1",
        "APCA-API-KEY-ID": credentials.keyId,
        "APCA-API-SECRET-KEY": credentials.secretKey,
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return err({
        code: "unauthorized",
        message: `${res.status} from Alpaca — check the key pair matches the base URL (paper vs live)`,
        status: res.status,
      });
    }
    if (res.status === 404) {
      return err({ code: "not_found", message: `404 ${url.pathname}`, status: 404 });
    }
    if (res.status === 429) {
      return err({ code: "rate_limited", message: "429 from Alpaca", status: 429 });
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

function err(error: AlpacaError): AlpacaOutcome<never> {
  return { ok: false, error };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 512);
  } catch {
    return "";
  }
}
