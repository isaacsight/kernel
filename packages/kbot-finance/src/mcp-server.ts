#!/usr/bin/env node
/**
 * kbot-finance MCP server.
 *
 * Exposes the kbot-finance tools to any MCP client — Claude Code, Cursor,
 * Claude.ai connectors, Replit Agent, kbot core, or anything else that
 * speaks the protocol. The same content-addressed envelope + verifier +
 * hash-chained audit log substrate that powers kbot's native tools is
 * now available over stdio MCP.
 *
 * Usage:
 *   npx @kernel.chat/kbot-finance mcp
 *
 * Or in an MCP client config:
 *   {
 *     "mcpServers": {
 *       "kbot-finance": {
 *         "command": "npx",
 *         "args": ["-y", "@kernel.chat/kbot-finance", "mcp"]
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { kbotFinanceTools, type KbotToolDefinition } from "./kbot-tool.js";

const SERVER_NAME = "kbot-finance";
const SERVER_VERSION = "0.2.0";

function paramsToJsonSchema(tool: KbotToolDefinition): {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
} {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const [name, spec] of Object.entries(tool.parameters)) {
    properties[name] = {
      type: spec.type,
      description: spec.description,
    };
    if (spec.required) required.push(name);
  }
  return { type: "object", properties, required };
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: kbotFinanceTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: paramsToJsonSchema(t),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = kbotFinanceTools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text" as const, text: `Error: unknown tool ${name}` }],
        isError: true,
      };
    }
    const result = await tool.execute((args ?? {}) as Record<string, unknown>);
    const isError = result.startsWith("Error");
    return {
      content: [{ type: "text" as const, text: result }],
      ...(isError ? { isError: true } : {}),
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The transport keeps the process alive on stdin/stdout.
  process.stderr.write(
    `${SERVER_NAME} v${SERVER_VERSION} MCP server ready on stdio — ${kbotFinanceTools.length} tools registered.\n`,
  );
}

// Run when invoked as a script via `npx @kernel.chat/kbot-finance mcp`
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer().catch((e) => {
    process.stderr.write(`mcp server fatal: ${(e as Error).message}\n`);
    process.exit(1);
  });
}
