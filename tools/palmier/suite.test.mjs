import assert from "node:assert/strict";
import { test } from "vitest";
import { listSuiteTools } from "./suite/catalog.mjs";
import { planners } from "./suite/planners.mjs";
import { executePlan } from "./suite/runner.mjs";
import { buildProvenanceManifest, evaluateRights, rankCreativeVariants, rankModels } from "./suite/intelligence.mjs";
import { adapterRoadmap } from "./suite/adapters.mjs";

test("catalog exposes the complete product platform", () => {
  assert.equal(listSuiteTools().length, 32);
  assert.deepEqual(Object.keys(planners), listSuiteTools().map((tool) => tool.id));
});

test("every planner returns the shared result contract", () => {
  for (const [name, planner] of Object.entries(planners)) {
    const plan = planner({});
    assert.equal(plan.schemaVersion, 1, name);
    assert.equal(plan.tool, name);
    assert.ok(Array.isArray(plan.operations), name);
    assert.ok(Array.isArray(plan.warnings), name);
    assert.ok(Array.isArray(plan.adapterRequirements), name);
    assert.ok(Array.isArray(plan.capabilities), name);
    for (const operation of plan.operations) {
      assert.equal(typeof operation.tool, "string", name);
      assert.equal(typeof operation.arguments, "object", name);
    }
  }
});

test("engine-level tools name their missing adapters", () => {
  for (const name of ["mediaPipeline", "compositor", "audioPost", "collaboration", "spatial"]) {
    const plan = planners[name]({});
    assert.equal(plan.status, "adapter_required", name);
    assert.ok(plan.adapterRequirements.length > 0, name);
  }
});

test("shot generation is approval gated", () => {
  const plan = planners.shots({ clipId: "abc", variations: [{ prompt: "Camera arcs as the subject turns", model: "seedance", duration: 5 }] });
  const generation = plan.operations.find((item) => item.tool === "generate_video");
  assert.equal(generation.costsCredits, true);
  assert.equal(generation.requiresApproval, true);
  assert.equal(plan.requiresApproval, true);
});

test("delivery is approval gated and refuses incomplete input", () => {
  assert.equal(planners.deliver({}).status, "needs_input");
  const plan = planners.deliver({ deliveries: [{ mode: "video", resolution: "1080p" }] });
  assert.equal(plan.status, "ready");
  assert.equal(plan.operations.at(-1).requiresApproval, true);
});

test("runner skips paid operations without approval", async () => {
  const calls = [];
  const schemas = {
    get_timeline: { type: "object" },
    inspect_timeline: { type: "object", properties: { startFrame: { type: "integer" } } },
    list_models: { type: "object", properties: { type: { type: "string" } } },
    generate_video: { type: "object", required: ["prompt"], properties: { prompt: {}, model: {}, duration: {}, aspectRatio: {}, folder: {} } },
  };
  const client = {
    request: async () => ({ tools: Object.entries(schemas).map(([name, inputSchema]) => ({ name, inputSchema })) }),
    call: async (name) => { calls.push(name); return { ok: true }; },
  };
  const plan = planners.shots({ clipId: "abc", variations: [{ prompt: "Camera arcs around product", model: "seedance", duration: 5 }] });
  const output = await executePlan(plan, { client });
  assert.deepEqual(calls, ["get_timeline", "inspect_timeline", "list_models"]);
  assert.equal(output.changes.at(-1).status, "approval_required");
});

test("model router enforces capability, provider, cost, and rights policy", () => {
  const ranked = rankModels([
    { id: "cheap", provider: "local", quality: 0.7, cost: 0, latencySeconds: 8, commercialUse: true, capabilities: ["image"] },
    { id: "great", provider: "cloud", quality: 0.95, cost: 5, latencySeconds: 20, commercialUse: true, capabilities: ["image", "reference"] },
  ], { allowedProviders: ["cloud"], requiredCapabilities: ["reference"], maxCost: 10 });
  assert.deepEqual(ranked.map((model) => model.id), ["great"]);
});

test("provenance policy blocks missing rights and expired assets", () => {
  const manifest = buildProvenanceManifest({ name: "Launch" }, [
    { id: "a", owner: "Studio", license: "owned" },
    { id: "b", synthetic: true, consent: "required", expiresAt: "2020-01-01" },
  ]);
  const review = evaluateRights(manifest, { at: "2026-01-01" });
  assert.equal(review.approved, false);
  assert.ok(review.issues.some((issue) => issue.code === "expired"));
  assert.ok(review.issues.some((issue) => issue.code === "missing_consent"));
});

test("outcome optimizer ranks variants from observed results", () => {
  const ranked = rankCreativeVariants([
    { id: "a", impressions: 100, completions: 60, conversions: 2, averageRetention: 0.7 },
    { id: "b", impressions: 100, completions: 80, conversions: 6, averageRetention: 0.8 },
  ]);
  assert.equal(ranked[0].id, "b");
});

test("engine roadmap is phased and every adapter has an owner", () => {
  const roadmap = adapterRoadmap();
  assert.equal(roadmap.length, 18);
  assert.ok(roadmap.every((adapter) => adapter.owner && adapter.deliverables.length));
  assert.deepEqual(roadmap.map((adapter) => adapter.phase), [...roadmap.map((adapter) => adapter.phase)].sort());
});
