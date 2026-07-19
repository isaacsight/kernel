export const ENGINE_ADAPTERS = Object.freeze({
  media: { phase: 1, owner: "media-engine", deliverables: ["proxies", "cache", "relink", "consolidate", "RAW decode"] },
  compositing: { phase: 1, owner: "render-engine", deliverables: ["node graph", "masks", "tracking", "keying", "2.5D"] },
  color: { phase: 1, owner: "color-engine", deliverables: ["OCIO/ACES", "HDR scopes", "power windows", "RAW controls"] },
  audio: { phase: 1, owner: "audio-engine", deliverables: ["buses", "plugins", "automation", "immersive routing", "stems"] },
  collaboration: { phase: 1, owner: "sync-engine", deliverables: ["presence", "permissions", "CRDT timeline", "review comments"] },
  recovery: { phase: 1, owner: "project-engine", deliverables: ["autosave", "repair", "relink", "AAF/OMF/EDL"] },
  extension: { phase: 2, owner: "generation-engine", deliverables: ["head/tail handles", "ambience continuation", "continuity scoring"] },
  localization: { phase: 2, owner: "language-engine", deliverables: ["translation", "dubbing", "lip sync", "regional text"] },
  identity: { phase: 2, owner: "identity-engine", deliverables: ["consent ledger", "digital doubles", "performance control"] },
  motion: { phase: 2, owner: "graphics-engine", deliverables: ["shapes", "expressions", "templates", "particles"] },
  memory: { phase: 3, owner: "agent-runtime", deliverables: ["project memory", "decision graph", "rejection ledger"] },
  agents: { phase: 3, owner: "agent-runtime", deliverables: ["specialist runtime", "consensus", "budget scheduler"] },
  compiler: { phase: 3, owner: "agent-runtime", deliverables: ["dependency graph", "partial recompilation", "alternate tracks"] },
  analytics: { phase: 3, owner: "intelligence-engine", deliverables: ["connectors", "attribution", "experiments"] },
  provenance: { phase: 3, owner: "governance-engine", deliverables: ["rights graph", "C2PA", "expiry enforcement", "signed manifests"] },
  routing: { phase: 3, owner: "generation-engine", deliverables: ["benchmarks", "policies", "cost and latency telemetry"] },
  living: { phase: 3, owner: "delivery-engine", deliverables: ["parameter binding", "schedules", "data connectors", "publishing policy"] },
  spatial: { phase: 4, owner: "render-engine", deliverables: ["stereo/360 viewer", "depth", "spatial audio", "immersive export"] },
});

export function adapterRoadmap() {
  return Object.entries(ENGINE_ADAPTERS)
    .map(([id, adapter]) => ({ id, ...adapter }))
    .sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id));
}
