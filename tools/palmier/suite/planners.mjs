import { operation, requireFields, result } from "./contracts.mjs";

const aspectSettings = {
  "16:9": { aspectRatio: "16:9", quality: "1080p" },
  "9:16": { aspectRatio: "9:16", quality: "1080p" },
  "1:1": { aspectRatio: "1:1", quality: "1080p" },
};

function readFoundation() {
  return [operation("get_timeline", {}), operation("get_media", {})];
}

export function director(input = {}) {
  const missing = requireFields(input, ["brief"]);
  const variant = input.variant ?? "Director's Cut";
  const ops = [
    ...readFoundation(),
    operation("create_timeline", { name: variant, ...(input.sourceTimelineId ? { from: input.sourceTimelineId } : {}) }, { mutatesTimeline: true, rationale: "Protect the source by developing the direction in a separate timeline." }),
  ];
  for (const beat of input.beats ?? []) {
    ops.push(operation("add_texts", { entries: [{ content: beat.label, startFrame: beat.startFrame, endFrame: beat.endFrame ?? beat.startFrame + beat.durationFrames }] }, { mutatesTimeline: true, rationale: "Create editable beat placeholders before media generation." }));
  }
  return result("director", input, ops, { missing, summary: "Prepared a protected brief-to-timeline workflow." });
}

export function campaign(input = {}) {
  const missing = requireFields(input, ["product", "audience", "objective"]);
  const formats = input.formats ?? ["16:9", "9:16", "1:1"];
  const ops = [...readFoundation()];
  for (const aspect of formats) {
    const name = `${input.campaignName ?? "Campaign"} ${aspect}`;
    ops.push(operation("create_timeline", { name, ...(input.sourceTimelineId ? { from: input.sourceTimelineId } : {}) }, { mutatesTimeline: true }));
    ops.push(operation("set_project_settings", aspectSettings[aspect] ?? { aspectRatio: aspect }, { mutatesTimeline: true }));
  }
  return result("campaign", input, ops, { missing, summary: `Prepared ${formats.length} campaign timeline variants.` });
}

export function shots(input = {}) {
  const missing = requireFields(input, ["clipId"]);
  const ops = [operation("get_timeline", {}), operation("inspect_timeline", { startFrame: input.frame ?? 0 }), operation("list_models", { type: "video" })];
  for (const variation of input.variations ?? []) {
    ops.push(operation("generate_video", {
      model: variation.model,
      prompt: variation.prompt,
      ...(variation.startFrameMediaRef ? { startFrameMediaRef: variation.startFrameMediaRef } : {}),
      ...(variation.endFrameMediaRef ? { endFrameMediaRef: variation.endFrameMediaRef } : {}),
      duration: variation.duration,
      aspectRatio: variation.aspectRatio ?? input.aspectRatio ?? "16:9",
      folder: input.folder ?? "Shot Lab",
    }, { costsCredits: true, requiresApproval: true, rationale: "Generate an approved, timeline-specific coverage variation." }));
  }
  return result("shots", input, ops, { missing, warnings: (input.variations ?? []).length ? [] : ["No generation variations supplied; inspection only."] });
}

export function continuity(input = {}) {
  const references = input.referenceMediaRefs ?? [];
  const ops = [operation("get_timeline", { captionDetail: false }), operation("get_media", {})];
  for (const mediaRef of references) ops.push(operation("inspect_media", { mediaRef, overview: true }));
  for (const clipId of input.clipIds ?? []) ops.push(operation("inspect_color", { clipId, ...(input.colorReferenceMediaRef ? { reference: input.colorReferenceMediaRef } : {}) }));
  return result("continuity", input, ops, { summary: "Prepared identity, composition, and color continuity inspection.", warnings: references.length ? [] : ["Add approved reference media to make continuity checks project-specific."] });
}

export function productTruth(input = {}) {
  const missing = requireFields(input, ["protectedFacts"]);
  const ops = [operation("get_timeline", { captionDetail: true }), operation("get_media", {})];
  for (const mediaRef of input.productMediaRefs ?? []) ops.push(operation("inspect_media", { mediaRef, overview: true }));
  return result("productTruth", input, ops, { missing, summary: "Prepared a non-mutating product, interface, text, and claims audit." });
}

export function recast(input = {}) {
  const missing = requireFields(input, ["sourceClipIds", "approvedIdentityReference", "consentConfirmed"]);
  const warnings = input.consentConfirmed === true ? [] : ["Identity replacement is blocked until consentConfirmed is true."];
  const ops = [operation("get_timeline", {}), operation("get_media", {})];
  if (input.approvedIdentityReference) ops.push(operation("inspect_media", { mediaRef: input.approvedIdentityReference }));
  return result("recast", input, ops, { missing, warnings, summary: "Prepared a consent-gated, sequence-level recast review. Palmier MCP currently has no native identity-replacement mutation." });
}

export function style(input = {}) {
  const missing = requireFields(input, ["constitution", "clipIds"]);
  const ops = [operation("get_timeline", {})];
  for (const clipId of input.clipIds ?? []) {
    ops.push(operation("inspect_color", { clipId, ...(input.referenceMediaRef ? { reference: input.referenceMediaRef } : {}) }));
    if (input.color) ops.push(operation("apply_color", { clipIds: [clipId], color: input.color }, { mutatesTimeline: true }));
    if (input.effects) ops.push(operation("apply_effect", { clipIds: [clipId], effects: input.effects }, { mutatesTimeline: true }));
  }
  return result("style", input, ops, { missing, summary: "Prepared project-wide style measurement and application." });
}

export function transitions(input = {}) {
  const missing = requireFields(input, ["leftClipId", "rightClipId", "cutFrame"]);
  const ops = [operation("get_timeline", {}), operation("inspect_timeline", { startFrame: input.cutFrame })];
  if (input.bridgeMediaRef) ops.push(operation("insert_clips", { atFrame: input.cutFrame, clips: [{ mediaRef: input.bridgeMediaRef, durationFrames: input.durationFrames ?? 12 }] }, { mutatesTimeline: true }));
  return result("transitions", input, ops, { missing, warnings: input.bridgeMediaRef ? [] : ["No bridge asset supplied; the tool will review whether the cut should remain clean."] });
}

export function performance(input = {}) {
  const ops = [operation("get_timeline", {}), operation("remove_silence", {}, { mutatesTimeline: true }), operation("get_transcript", {})];
  if ((input.removeWords ?? []).length) ops.push(operation("remove_words", { matches: input.removeWords }, { mutatesTimeline: true }));
  if (input.captions) ops.push(operation("add_captions", { style: input.captionStyle ?? {} }, { mutatesTimeline: true }));
  for (const clipId of input.denoiseClipIds ?? []) ops.push(operation("denoise_audio", { clipIds: [clipId], strength: input.denoiseStrength ?? 0.6 }, { mutatesTimeline: true }));
  return result("performance", input, ops, { summary: "Prepared silence removal, transcript editing, cleanup, and captions." });
}

export function shorts(input = {}) {
  const missing = requireFields(input, ["sourceTimelineId"]);
  const variants = input.variants ?? [{ name: "Short 9x16", aspectRatio: "9:16" }, { name: "Square 1x1", aspectRatio: "1:1" }];
  const ops = [operation("get_media", {})];
  for (const variant of variants) {
    ops.push(operation("create_timeline", { name: variant.name, from: input.sourceTimelineId }, { mutatesTimeline: true }));
    ops.push(operation("set_project_settings", aspectSettings[variant.aspectRatio] ?? { aspectRatio: variant.aspectRatio }, { mutatesTimeline: true }));
    if (variant.startFrame !== undefined && variant.endFrame !== undefined && input.sourceEndFrame !== undefined && input.trackIndex !== undefined) {
      ops.push(operation("ripple_delete_ranges", { ranges: [[variant.endFrame, input.sourceEndFrame], [0, variant.startFrame]], units: "frames", trackIndex: input.trackIndex }, { mutatesTimeline: true }));
    }
  }
  return result("shorts", input, ops, { missing, summary: `Prepared ${variants.length} protected social derivatives.` });
}

export function critic(input = {}) {
  const ops = [operation("get_timeline", { captionDetail: true }), operation("inspect_timeline", { startFrame: input.sampleFrame ?? 0 }), operation("get_transcript", {})];
  if (input.musicMediaRef) ops.push(operation("detect_beats", { mediaRef: input.musicMediaRef }));
  return result("critic", input, ops, { summary: "Prepared a non-mutating pacing, clarity, caption, and audio evidence review." });
}

export function deliver(input = {}) {
  const missing = requireFields(input, ["deliveries"]);
  const ops = [operation("get_timeline", { captionDetail: true })];
  for (const clipId of input.denoiseClipIds ?? []) ops.push(operation("denoise_audio", { clipIds: [clipId], strength: input.denoiseStrength ?? 0.6 }, { mutatesTimeline: true }));
  for (const delivery of input.deliveries ?? []) {
    ops.push(operation("export_project", {
      mode: delivery.mode ?? "video",
      ...(delivery.codec ? { codec: delivery.codec } : {}),
      ...(delivery.resolution ? { resolution: delivery.resolution } : {}),
      ...(delivery.outputPath ? { outputPath: delivery.outputPath } : {}),
      overwrite: delivery.overwrite ?? false,
    }, { requiresApproval: true, rationale: "Final delivery is an explicit approval gate." }));
  }
  return result("deliver", input, ops, { missing, summary: `Prepared ${input.deliveries?.length ?? 0} delivery jobs with final approval gates.` });
}

function adapterPlan(name, input, adapterRequirements, operations = [], options = {}) {
  return result(name, input, operations, {
    ...options,
    adapterRequirements,
    warnings: [...(options.warnings ?? []), `Requires Palmier engine support: ${adapterRequirements.join(", ")}.`],
  });
}

export function mediaPipeline(input = {}) {
  const ops = [...readFoundation()];
  for (const path of input.importPaths ?? []) ops.push(operation("import_media", { source: { path } }, { mutatesTimeline: false }));
  return adapterPlan("mediaPipeline", input, ["proxy generation", "render cache", "relink and consolidate API", "camera RAW decode"], ops, { capabilities: ["inventory", "import"] });
}

export function compositor(input = {}) {
  const ops = [operation("get_timeline", {})];
  for (const clipId of input.clipIds ?? []) {
    if (input.effects?.length) ops.push(operation("apply_effect", { clipIds: [clipId], effects: input.effects }, { mutatesTimeline: true }));
  }
  return adapterPlan("compositor", input, ["node graph", "tracked masks", "planar and camera tracking", "keyer", "rotoscope", "2.5D renderer"], ops, { capabilities: ["editable effect stacks"] });
}

export function colorPipeline(input = {}) {
  const missing = requireFields(input, ["clipIds"]);
  const ops = [operation("get_timeline", {})];
  for (const clipId of input.clipIds ?? []) ops.push(operation("inspect_color", { clipId, ...(input.referenceMediaRef ? { reference: input.referenceMediaRef } : {}) }));
  if (input.grade) ops.push(operation("apply_color", { clipIds: input.clipIds ?? [], color: input.grade }, { mutatesTimeline: true }));
  const plan = adapterPlan("colorPipeline", input, ["OCIO/ACES color management", "HDR scopes and monitoring", "tracked power windows", "RAW controls"], ops, { capabilities: ["scopes", "reference matching", "editable grades"] });
  if (missing.length) { plan.status = "needs_input"; plan.warnings.push(`Missing required input: ${missing.join(", ")}`); }
  return plan;
}

export function audioPost(input = {}) {
  const ops = [operation("get_timeline", {})];
  for (const clipId of input.dialogueClipIds ?? []) ops.push(operation("denoise_audio", { clipIds: [clipId], strength: input.denoiseStrength ?? 0.6 }, { mutatesTimeline: true }));
  return adapterPlan("audioPost", input, ["track and bus mixer", "EQ/dynamics plugins", "automation lanes", "surround and immersive routing", "stem export"], ops, { capabilities: ["dialogue denoise"] });
}

export function collaboration(input = {}) {
  return adapterPlan("collaboration", input, ["realtime project sync", "presence and permissions", "conflict-free timeline merge", "timestamped review service"], [operation("get_timeline", {})], { capabilities: ["timeline copies", "shared undo history"] });
}

export function generativeExtend(input = {}) {
  const missing = requireFields(input, ["sourceVideoMediaRef", "prompt"]);
  const ops = [operation("get_timeline", {}), operation("list_models", { type: "video" })];
  if (!missing.length) ops.push(operation("generate_video", { prompt: input.prompt, sourceVideoMediaRef: input.sourceVideoMediaRef, ...(input.sourceClipId ? { sourceClipId: input.sourceClipId } : {}), model: input.model, folder: input.folder ?? "Generative Extend" }, { costsCredits: true, requiresApproval: true }));
  return adapterPlan("generativeExtend", input, ["native head/tail extension contract", "source-handle replacement and optical continuity validation"], ops, { capabilities: ["video-to-video generation"], warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [] });
}

export function intelligence(input = {}) {
  const missing = requireFields(input, ["query"]);
  const ops = [operation("get_media", {})];
  if (input.query) ops.push(operation("search_media", { query: input.query }));
  for (const mediaRef of input.inspectMediaRefs ?? []) ops.push(operation("inspect_media", { mediaRef, overview: true }));
  return result("intelligence", input, ops, { missing, capabilities: ["semantic visual search", "spoken search", "transcription", "storyboards"], summary: "Prepared multimodal footage discovery and inspection." });
}

export function localization(input = {}) {
  const missing = requireFields(input, ["targetLanguages"]);
  const ops = [operation("get_timeline", {}), operation("get_transcript", {})];
  for (const language of input.targetLanguages ?? []) {
    ops.push(operation("generate_audio", { model: input.dubbingModel, prompt: input.scriptByLanguage?.[language] ?? `Translate and dub to ${language}`, sourceMediaRef: input.sourceMediaRef, targetLanguage: language, folder: `Localization/${language}` }, { costsCredits: true, requiresApproval: true }));
  }
  return adapterPlan("localization", input, ["caption translation API", "lip-sync mutation", "regional text replacement"], ops, { capabilities: ["dubbing generation", "captions", "timeline variants"], warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [] });
}

export function avatar(input = {}) {
  const missing = requireFields(input, ["consentConfirmed", "identityReferenceMediaRef", "script"]);
  const ops = [operation("get_media", {})];
  if (input.identityReferenceMediaRef) ops.push(operation("inspect_media", { mediaRef: input.identityReferenceMediaRef, overview: true }));
  return adapterPlan("avatar", input, ["consent ledger", "digital-double model", "gesture and lip-sync controls"], ops, { warnings: input.consentConfirmed === true ? [] : ["Synthetic presenter creation is blocked until consentConfirmed is true."] });
}

export function motionGraphics(input = {}) {
  const missing = requireFields(input, ["entries"]);
  const ops = [operation("get_timeline", {})];
  if ((input.entries ?? []).length) ops.push(operation("add_texts", { entries: input.entries }, { mutatesTimeline: true }));
  return adapterPlan("motionGraphics", input, ["shape layers", "expressions", "template parameter schema", "vector and particle renderer"], ops, { capabilities: ["animated text clips"], warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [] });
}

export function productionMemory(input = {}) {
  const missing = requireFields(input, ["constitution"]);
  return adapterPlan("productionMemory", input, ["project-scoped durable memory store", "reference and decision graph", "rejected-decision ledger"], [...readFoundation()], { warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [], artifacts: [{ type: "production-memory", value: input.constitution ?? {} }] });
}

export function coverage(input = {}) {
  const ops = [operation("get_timeline", { captionDetail: true }), operation("get_media", {}), operation("get_transcript", {})];
  if (input.query) ops.push(operation("search_media", { query: input.query }));
  return result("coverage", input, ops, { capabilities: ["timeline inspection", "media search", "transcript coverage"], summary: "Prepared a search-before-generate coverage audit." });
}

export function assembly(input = {}) {
  const missing = requireFields(input, ["brief"]);
  return adapterPlan("assembly", input, ["specialist-agent runtime", "disagreement and consensus ledger", "cross-agent budget scheduler"], [...readFoundation(), operation("get_transcript", {})], { warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [], artifacts: [{ type: "agent-roster", value: ["producer", "director", "editor", "cinematographer", "colorist", "sound", "brand", "delivery"] }] });
}

export function compiler(input = {}) {
  const missing = requireFields(input, ["brief", "timelineName"]);
  const ops = [...readFoundation()];
  if (input.timelineName) ops.push(operation("create_timeline", { name: input.timelineName, ...(input.sourceTimelineId ? { from: input.sourceTimelineId } : {}) }, { mutatesTimeline: true }));
  for (const entry of input.textEntries ?? []) ops.push(operation("add_texts", { entries: [entry] }, { mutatesTimeline: true }));
  return adapterPlan("compiler", input, ["dependency graph for partial recompilation", "placeholder and alternate-track schema"], ops, { capabilities: ["timeline creation", "editable clips", "text layers"], warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [] });
}

export function optimizer(input = {}) {
  const missing = requireFields(input, ["performanceData"]);
  return adapterPlan("optimizer", input, ["platform analytics connectors", "variant-to-outcome attribution", "experiment registry"], [operation("get_timeline", {})], { warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [], artifacts: [{ type: "performance-evidence", value: input.performanceData ?? {} }] });
}

export function provenance(input = {}) {
  return adapterPlan("provenance", input, ["asset-level rights database", "C2PA signing", "consent and license expiration enforcement", "export manifest embedding"], [...readFoundation()], { artifacts: [{ type: "provenance-manifest", value: { assets: input.assets ?? [], policies: input.policies ?? [] } }] });
}

export function router(input = {}) {
  const missing = requireFields(input, ["task"]);
  const ops = [operation("list_models", input.type ? { type: input.type } : {})];
  return adapterPlan("router", input, ["model benchmark history", "rights and enterprise policy registry", "latency and cost telemetry"], ops, { capabilities: ["live model capability catalog"], warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [] });
}

export function living(input = {}) {
  const missing = requireFields(input, ["sourceTimelineId", "variants"]);
  const ops = [operation("get_media", {})];
  for (const variant of input.variants ?? []) ops.push(operation("create_timeline", { name: variant.name, from: input.sourceTimelineId }, { mutatesTimeline: true }));
  return adapterPlan("living", input, ["parameter binding", "scheduled regeneration", "source-data connectors", "policy-aware publishing"], ops, { capabilities: ["versioned timeline derivatives"], warnings: missing.length ? [`Missing required input: ${missing.join(", ")}`] : [] });
}

export function spatial(input = {}) {
  return adapterPlan("spatial", input, ["stereo and 360 viewer", "depth and camera representation", "spatial audio buses", "immersive export formats"], [operation("get_timeline", {})]);
}

export function recovery(input = {}) {
  const ops = [...readFoundation()];
  if (input.packageProject) ops.push(operation("export_project", { mode: "palmier", ...(input.outputPath ? { outputPath: input.outputPath } : {}), overwrite: false }, { requiresApproval: true }));
  if (input.handoff === "premiere") ops.push(operation("export_project", { mode: "xml", overwrite: false }, { requiresApproval: true }));
  if (input.handoff === "resolve" || input.handoff === "fcp") ops.push(operation("export_project", { mode: "fcpxml", fcpxmlTarget: input.handoff === "fcp" ? "fcp" : "resolve", overwrite: false }, { requiresApproval: true }));
  return adapterPlan("recovery", input, ["autosave snapshot API", "project repair", "proxy relink", "AAF/OMF/EDL interchange"], ops, { capabilities: ["Palmier package", "XML", "FCPXML"] });
}

export const planners = {
  director, campaign, shots, continuity, productTruth, recast, style, transitions, performance, shorts, critic, deliver,
  mediaPipeline, compositor, colorPipeline, audioPost, collaboration, generativeExtend, intelligence, localization, avatar,
  motionGraphics, productionMemory, coverage, assembly, compiler, optimizer, provenance, router, living, spatial, recovery,
};
