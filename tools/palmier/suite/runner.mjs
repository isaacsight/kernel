import { PalmierClient } from "../mcp-client.mjs";

export async function executePlan(plan, options = {}) {
  if (plan.status !== "ready") throw new Error(`Plan is not executable: ${plan.warnings.join(" ")}`);
  const client = options.client ?? await PalmierClient.connect(options.connection);
  const advertised = await client.request("tools/list");
  const schemas = new Map(advertised.tools.map((tool) => [tool.name, tool.inputSchema ?? {}]));
  const receipts = [];
  for (const item of plan.operations) {
    const schema = schemas.get(item.tool);
    if (!schema) throw new Error(`Palmier does not advertise required tool "${item.tool}".`);
    const unknown = schema.properties ? Object.keys(item.arguments).filter((key) => !schema.properties[key]) : Object.keys(item.arguments);
    if (unknown.length) throw new Error(`${item.tool} received unsupported arguments: ${unknown.join(", ")}`);
    const missing = (schema.required ?? []).filter((key) => item.arguments[key] === undefined);
    if (missing.length) throw new Error(`${item.tool} is missing required arguments: ${missing.join(", ")}`);
    if (item.costsCredits && !options.approveGeneration) {
      receipts.push({ tool: item.tool, status: "approval_required", reason: "Paid generation was not approved." });
      continue;
    }
    if (item.requiresApproval && !item.costsCredits && !options.approveFinal) {
      receipts.push({ tool: item.tool, status: "approval_required", reason: "Final or externalized action was not approved." });
      continue;
    }
    const value = await client.call(item.tool, item.arguments);
    receipts.push({ tool: item.tool, status: "completed", value });
  }
  return { ...plan, changes: receipts, undoToken: receipts.some((entry) => entry.status === "completed") ? "palmier-shared-undo-history" : null };
}
