#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { listSuiteTools, PALMIER_TOOLS } from "./suite/catalog.mjs";
import { planners } from "./suite/planners.mjs";
import { executePlan } from "./suite/runner.mjs";
import { adapterRoadmap } from "./suite/adapters.mjs";

function usage() {
  console.log(`Usage:
  node tools/palmier/suite.mjs list
  node tools/palmier/suite.mjs adapters
  node tools/palmier/suite.mjs plan <tool> [--input file.json]
  node tools/palmier/suite.mjs run <tool> --input file.json [--approve-generation] [--approve-final]

Run is approval-safe: paid generation and final exports are skipped unless their explicit flags are present.`);
}

const args = process.argv.slice(2);
const command = args[0];
if (!command || args.includes("--help")) {
  usage();
  process.exit(command ? 0 : 1);
}
if (command === "list") {
  console.log(JSON.stringify(listSuiteTools(), null, 2));
  process.exit(0);
}
if (command === "adapters") {
  console.log(JSON.stringify(adapterRoadmap(), null, 2));
  process.exit(0);
}
const toolId = args[1];
if (!PALMIER_TOOLS[toolId]) throw new Error(`Unknown suite tool "${toolId}". Run "npm run video:palmier:suite -- list".`);
const inputIndex = args.indexOf("--input");
const input = inputIndex >= 0 ? JSON.parse(readFileSync(args[inputIndex + 1], "utf8")) : {};
const plan = planners[toolId](input);
if (command === "plan") {
  console.log(JSON.stringify(plan, null, 2));
} else if (command === "run") {
  const executed = await executePlan(plan, { approveGeneration: args.includes("--approve-generation"), approveFinal: args.includes("--approve-final") });
  console.log(JSON.stringify(executed, null, 2));
} else {
  usage();
  process.exit(1);
}
