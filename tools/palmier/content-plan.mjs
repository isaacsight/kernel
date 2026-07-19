#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RECIPES = {
  launch: {
    label: "Product launch",
    defaultDuration: 45,
    beats: [
      ["hook", 0.12, "Open on the outcome, tension, or most surprising capability."],
      ["problem", 0.18, "Make the old workflow and its cost instantly recognizable."],
      ["reveal", 0.18, "Reveal the product and state the promise in one sentence."],
      ["proof", 0.34, "Show two or three concrete product moments with visible results."],
      ["close", 0.18, "Land the value, brand, and one clear call to action."],
    ],
  },
  demo: {
    label: "Product demo",
    defaultDuration: 60,
    beats: [
      ["outcome", 0.12, "Show the finished result before explaining the workflow."],
      ["setup", 0.15, "Establish the user, input, and goal."],
      ["workflow", 0.48, "Demonstrate the shortest credible path through the product."],
      ["proof", 0.15, "Compare the result or show a measurable benefit."],
      ["cta", 0.10, "Give the viewer one next action."],
    ],
  },
  social: {
    label: "Short-form social",
    defaultDuration: 25,
    beats: [
      ["hook", 0.16, "Earn attention in the first two seconds with a visual claim."],
      ["context", 0.16, "Give only the context needed to understand the payoff."],
      ["payoff", 0.44, "Deliver the transformation, demonstration, or reveal."],
      ["proof", 0.12, "Add a result, reaction, or credibility marker."],
      ["loop", 0.12, "Close with a CTA or visual that loops into the opening."],
    ],
  },
  brand: {
    label: "Brand film",
    defaultDuration: 75,
    beats: [
      ["world", 0.16, "Establish a distinctive visual world and emotional question."],
      ["human", 0.22, "Introduce the person, belief, or behavior at the center."],
      ["journey", 0.34, "Build a progression through actions rather than claims."],
      ["meaning", 0.18, "Connect the story to what the brand makes possible."],
      ["signature", 0.10, "End on a memorable brand image and minimal copy."],
    ],
  },
};

function usage() {
  console.log(`Usage:
  node tools/palmier/content-plan.mjs <recipe> <brief> [options]

Recipes: ${Object.keys(RECIPES).join(", ")}
Options:
  --duration <seconds>   Override recipe duration
  --aspect <ratio>       16:9, 9:16, 1:1 (default: 16:9)
  --output <path>        Write JSON to a file instead of stdout

Example:
  npm run video:palmier:plan -- launch "Introduce our AI research agent" --duration 45`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.length < 2) {
  usage();
  process.exit(args.includes("--help") ? 0 : 1);
}

const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const recipeId = args[0];
const recipe = RECIPES[recipeId];
if (!recipe) throw new Error(`Unknown recipe "${recipeId}". Use: ${Object.keys(RECIPES).join(", ")}`);

const brief = args[1];
const duration = Number(option("--duration", recipe.defaultDuration));
const aspectRatio = option("--aspect", "16:9");
const output = option("--output", null);
if (!Number.isFinite(duration) || duration <= 0) throw new Error("Duration must be a positive number");
if (!["16:9", "9:16", "1:1"].includes(aspectRatio)) throw new Error("Aspect must be 16:9, 9:16, or 1:1");

let cursor = 0;
const beats = recipe.beats.map(([id, share, purpose], index) => {
  const start = cursor;
  const end = index === recipe.beats.length - 1 ? duration : Math.round((cursor + duration * share) * 10) / 10;
  cursor = end;
  return {
    id,
    startSeconds: start,
    endSeconds: end,
    durationSeconds: Math.round((end - start) * 10) / 10,
    purpose,
    coverage: ["primary shot", "detail or interface", "reaction or consequence"],
    audio: "Define narration/dialogue, production sound, music change, and transition cue.",
    generationNotes: "Specify subject, action, environment, framing, lens, movement, lighting, and continuity references.",
  };
});

const plan = {
  schemaVersion: 1,
  title: recipe.label,
  recipe: recipeId,
  brief,
  format: { durationSeconds: duration, aspectRatio, safeArea: aspectRatio === "9:16" ? "Keep essential text and faces in the center 80%." : "Keep essential text inside title-safe margins." },
  creativeQuestions: [
    "Who is the exact viewer and what do they already believe?",
    "What single outcome should they remember?",
    "What can be shown as proof rather than stated as copy?",
    "Which product, person, or visual traits must remain consistent across generated shots?",
  ],
  beats,
  palmierWorkflow: [
    "Import product footage, brand assets, references, and music into organized library folders.",
    "Create one timeline marker or placeholder clip per beat before generating media.",
    "Generate first and last frames for continuity-critical shots, then generate video between them.",
    "Build the proof section first; the hook and close should be derived from real proof footage.",
    "Use imported and generated footage on the same timeline; keep alternates off the primary track.",
    "Run timeline audit, cut-sheet review, export mastering, and delivery QC before approval.",
  ],
  approvalGates: ["brief and claim accuracy", "beat structure", "picture lock", "audio master", "delivery export"],
};

const serialized = `${JSON.stringify(plan, null, 2)}\n`;
if (output) {
  const path = resolve(output);
  writeFileSync(path, serialized);
  console.log(path);
} else {
  process.stdout.write(serialized);
}
