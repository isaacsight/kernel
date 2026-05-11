#!/usr/bin/env node
/**
 * Bin entrypoint for @kernel.chat/kbot-finance.
 *
 *   npx @kernel.chat/kbot-finance mcp    → start the MCP server on stdio
 *   npx @kernel.chat/kbot-finance demo   → run the end-to-end demo
 *
 * Default (no args) prints usage.
 */
import { startMcpServer } from "./mcp-server.js";

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "mcp": {
      await startMcpServer();
      return;
    }
    case "demo": {
      // Dynamic import so demo's top-level side effects don't run at module load.
      await import("./demo.js");
      return;
    }
    default: {
      process.stdout.write(
        `@kernel.chat/kbot-finance — audit-grade AI infrastructure\n\n` +
          `Usage:\n` +
          `  kbot-finance mcp    Start the MCP server on stdio\n` +
          `  kbot-finance demo   Run the end-to-end demo against live Polymarket\n\n` +
          `MCP client config snippet:\n` +
          `  {\n` +
          `    "mcpServers": {\n` +
          `      "kbot-finance": {\n` +
          `        "command": "npx",\n` +
          `        "args": ["-y", "@kernel.chat/kbot-finance", "mcp"]\n` +
          `      }\n` +
          `    }\n` +
          `  }\n`,
      );
    }
  }
}

main().catch((e) => {
  process.stderr.write(`fatal: ${(e as Error).message}\n`);
  process.exit(1);
});
