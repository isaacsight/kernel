export const TOOL_STATUS = Object.freeze({ READY: "ready", NEEDS_INPUT: "needs_input", ADAPTER_REQUIRED: "adapter_required" });

export function operation(tool, arguments_, options = {}) {
  return {
    tool,
    arguments: arguments_,
    mutatesTimeline: options.mutatesTimeline ?? false,
    costsCredits: options.costsCredits ?? false,
    requiresApproval: options.requiresApproval ?? false,
    rationale: options.rationale ?? "",
  };
}

export function result(name, input, operations, options = {}) {
  const warnings = [...(options.warnings ?? [])];
  const missing = options.missing ?? [];
  if (missing.length) warnings.push(`Missing required input: ${missing.join(", ")}`);
  const adapterRequirements = options.adapterRequirements ?? [];
  return {
    schemaVersion: 1,
    tool: name,
    status: missing.length ? TOOL_STATUS.NEEDS_INPUT : adapterRequirements.length ? TOOL_STATUS.ADAPTER_REQUIRED : TOOL_STATUS.READY,
    summary: options.summary ?? `${name} prepared ${operations.length} Palmier operations.`,
    input,
    changes: [],
    warnings,
    costEstimate: options.costEstimate ?? null,
    requiresApproval: operations.some((item) => item.requiresApproval),
    undoToken: null,
    artifacts: options.artifacts ?? [],
    adapterRequirements,
    capabilities: options.capabilities ?? [],
    operations,
  };
}

export function requireFields(input, fields) {
  return fields.filter((field) => {
    const value = input[field];
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  });
}
