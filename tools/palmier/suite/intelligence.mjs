function number(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function rankModels(models, policy = {}) {
  const weights = { quality: 0.4, cost: 0.25, latency: 0.15, rights: 0.2, ...(policy.weights ?? {}) };
  const maxCost = Math.max(...models.map((model) => number(model.cost, 0)), 1);
  const maxLatency = Math.max(...models.map((model) => number(model.latencySeconds, 0)), 1);
  return models
    .filter((model) => !policy.allowedProviders || policy.allowedProviders.includes(model.provider))
    .filter((model) => !policy.requiredCapabilities || policy.requiredCapabilities.every((capability) => model.capabilities?.includes(capability)))
    .filter((model) => policy.maxCost === undefined || number(model.cost, Infinity) <= policy.maxCost)
    .map((model) => {
      const score = weights.quality * number(model.quality, 0.5)
        + weights.cost * (1 - number(model.cost, maxCost) / maxCost)
        + weights.latency * (1 - number(model.latencySeconds, maxLatency) / maxLatency)
        + weights.rights * (model.commercialUse === true ? 1 : 0);
      return { ...model, score: Math.round(score * 1000) / 1000 };
    })
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

export function buildProvenanceManifest(project, assets = []) {
  return {
    schemaVersion: 1,
    project: { id: project.id ?? null, name: project.name ?? "Untitled", timelineId: project.timelineId ?? null },
    createdAt: new Date().toISOString(),
    assets: assets.map((asset) => ({
      id: asset.id,
      source: asset.source ?? "unknown",
      owner: asset.owner ?? null,
      license: asset.license ?? null,
      consent: asset.consent ?? null,
      model: asset.model ?? null,
      promptDigest: asset.promptDigest ?? null,
      references: asset.references ?? [],
      territories: asset.territories ?? ["worldwide"],
      expiresAt: asset.expiresAt ?? null,
      synthetic: Boolean(asset.synthetic),
    })),
  };
}

export function evaluateRights(manifest, context = {}) {
  const at = new Date(context.at ?? Date.now());
  const territory = context.territory ?? "worldwide";
  const issues = [];
  for (const asset of manifest.assets ?? []) {
    if (!asset.owner) issues.push({ assetId: asset.id, severity: "error", code: "missing_owner" });
    if (!asset.license) issues.push({ assetId: asset.id, severity: "error", code: "missing_license" });
    if (asset.synthetic && asset.consent === "required") issues.push({ assetId: asset.id, severity: "error", code: "missing_consent" });
    if (asset.expiresAt && new Date(asset.expiresAt) < at) issues.push({ assetId: asset.id, severity: "error", code: "expired" });
    if (!asset.territories.includes("worldwide") && !asset.territories.includes(territory)) issues.push({ assetId: asset.id, severity: "error", code: "territory_block" });
  }
  return { approved: issues.length === 0, issues };
}

export function rankCreativeVariants(variants = []) {
  return variants.map((variant) => {
    const impressions = Math.max(number(variant.impressions, 0), 1);
    const completionRate = number(variant.completions, 0) / impressions;
    const conversionRate = number(variant.conversions, 0) / impressions;
    const retention = number(variant.averageRetention, 0);
    const score = 0.35 * completionRate + 0.4 * conversionRate + 0.25 * retention;
    return { ...variant, completionRate, conversionRate, score };
  }).sort((a, b) => b.score - a.score);
}
