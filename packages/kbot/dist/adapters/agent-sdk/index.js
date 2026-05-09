// Anthropic Agent SDK adapter — bidirectional schema translation between
// kbot's ToolDefinition surface and the Agent SDK / Messages API tool surface.
//
// kbot stays provider-agnostic — this adapter takes no runtime dependency
// on @anthropic-ai/sdk. It only translates schemas and (for the from-side)
// wraps optional executors. Round-trip kbot → Agent SDK → kbot is stable
// for the parameter shapes kbot itself uses.
//
// Background: with the Anthropic Agent SDK opening to external developers
// in May 2026, kbot tools can now be advertised to that ecosystem and
// vice-versa — without coupling the registry to one provider's runtime.
export { toAgentSdkTool, toAgentSdkTools, } from './to-agent-sdk.js';
export { fromAgentSdkTool, fromAgentSdkExecutableTool, fromAgentSdkTools, } from './from-agent-sdk.js';
//# sourceMappingURL=index.js.map