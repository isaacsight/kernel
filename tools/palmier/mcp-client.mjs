const DEFAULT_URL = "http://127.0.0.1:19789/mcp";

function parseSse(text) {
  const messages = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: ") && line.length > 6)
    .map((line) => JSON.parse(line.slice(6)));

  if (messages.length === 0) {
    throw new Error("Palmier returned no MCP message");
  }

  return messages.at(-1);
}

export class PalmierClient {
  constructor({ url = DEFAULT_URL, sessionId } = {}) {
    this.url = url;
    this.sessionId = sessionId;
    this.requestId = 1;
  }

  static async connect(options = {}) {
    const client = new PalmierClient(options);
    const response = await client.request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "galley-palmier-tools", version: "1.0.0" },
    }, { includeSession: false });

    client.sessionId = response.sessionId;
    await client.notify("notifications/initialized");
    return client;
  }

  async request(method, params = {}, { includeSession = true } = {}) {
    const headers = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    };
    if (includeSession && this.sessionId) {
      headers["MCP-Session-Id"] = this.sessionId;
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: this.requestId++,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Palmier MCP HTTP ${response.status}`);
    }

    const sessionId = response.headers.get("mcp-session-id") ?? this.sessionId;
    const message = parseSse(await response.text());
    if (message.error) {
      throw new Error(message.error.message ?? JSON.stringify(message.error));
    }
    return { ...message.result, sessionId };
  }

  async notify(method, params = {}) {
    const headers = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Session-Id": this.sessionId,
    };
    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method, params }),
    });
    if (!response.ok) {
      throw new Error(`Palmier MCP notification HTTP ${response.status}`);
    }
  }

  async call(name, args = {}) {
    const result = await this.request("tools/call", {
      name,
      arguments: args,
    });
    const text = result.content?.find((item) => item.type === "text")?.text;
    if (!text) return result;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
