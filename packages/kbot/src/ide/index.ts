// K:BOT IDE Matrix — Protocol adapters for universal IDE integration
//
// Three protocols, every major IDE:
//   MCP  → VS Code, Cursor, Windsurf, Zed, Neovim
//   ACP  → JetBrains (IntelliJ, WebStorm, PyCharm, GoLand, Android Studio)
//   LSP  → All editors (diagnostics feedback loop)

export { startMcpServer } from './mcp-server.js'
export { startAcpServer } from './acp-server.js'
export { getDiagnostics, formatDiagnostics, type Diagnostic, type LspBridgeOptions } from './lsp-bridge.js'
export {
  initBridge,
  chat,
  executeCommand,
  getContext,
  getTools,
  getToolList,
  getStatus,
  getAgents,
  getMemory,
  getSessions,
  getFileDiagnostics,
  remember,
  setAgent,
  refreshContext,
  train,
  type BridgeConfig,
  type BridgeStatus,
  type ChatOptions,
} from './bridge.js'
