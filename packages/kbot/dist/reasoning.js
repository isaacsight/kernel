// kbot Advanced Reasoning Engine — Abductive, Counterfactual, Meta-Planning
//
// Three reasoning systems that operate without LLM calls:
//
//   1. ABDUCTIVE REASONING — Inference to best explanation.
//      Given an error/symptom, generate ranked hypotheses about root cause,
//      then refine via test-and-eliminate loop.
//
//   2. COUNTERFACTUAL THINKING — "What if we did X instead?"
//      Analyze alternative approaches without executing them, compare
//      tradeoffs, and recommend whether to pivot.
//
//   3. META-PLANNING — Planning about how to plan.
//      Choose the right planning strategy based on task characteristics,
//      adapt strategies mid-execution when things go wrong.
//
// All reasoning is pure heuristic — zero API calls, zero external deps.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { registerTool } from './tools/index.js';
// ── Helpers ──
function shortId() {
    return randomBytes(4).toString('hex');
}
function kbotDir() {
    const dir = join(homedir(), '.kbot');
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return dir;
}
function loadJson(path, fallback) {
    try {
        if (existsSync(path))
            return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch { /* corrupt file — return fallback */ }
    return fallback;
}
function saveJson(path, data) {
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}
const TYPESCRIPT_CAUSE_MAP = [
    {
        pattern: /TS2322.*Type '(.+)' is not assignable to type '(.+)'/i,
        causes: [
            { explanation: 'Type mismatch — the value type does not match the expected type. Check the assignment or function argument.', likelihood: 0.85, testable: true, testAction: 'Read the file at the error line and compare the actual type with the expected type' },
            { explanation: 'Stale type definitions — a dependency was updated but its types are outdated. The @types package may need updating.', likelihood: 0.3, testable: true, testAction: 'Check the dependency version and its @types package version with npm ls' },
            { explanation: 'Generic type inference failure — TypeScript cannot infer the correct generic. An explicit type annotation may be needed.', likelihood: 0.25, testable: true, testAction: 'Add explicit generic type parameters and re-run tsc' },
        ],
    },
    {
        pattern: /TS2339.*Property '(.+)' does not exist on type/i,
        causes: [
            { explanation: 'Missing property on the type — the object does not have this field. Check for typos or extend the interface.', likelihood: 0.8, testable: true, testAction: 'Read the type definition and check if the property name is correct or needs to be added' },
            { explanation: 'Incorrect type narrowing — the variable is typed as a union and needs a type guard before accessing the property.', likelihood: 0.45, testable: true, testAction: 'Check if the variable is a union type and add a type guard (if/in check) before the access' },
            { explanation: 'Missing import — the correct type is defined but not imported, and a different type with the same name is being used.', likelihood: 0.2, testable: true, testAction: 'Search for the type definition in the codebase and verify the import path' },
        ],
    },
    {
        pattern: /TS2307.*Cannot find module '(.+)'/i,
        causes: [
            { explanation: 'Missing dependency — the package is not installed. Run npm install.', likelihood: 0.6, testable: true, testAction: 'Check package.json for the dependency and run npm install if missing' },
            { explanation: 'Incorrect import path — the relative path is wrong or missing the file extension.', likelihood: 0.5, testable: true, testAction: 'Verify the file exists at the import path, check for .js extension requirement (ESM)' },
            { explanation: 'Missing type declarations — the package exists but has no types. Install @types/package or declare the module.', likelihood: 0.35, testable: true, testAction: 'Check if @types/<package> exists on npm and install it' },
            { explanation: 'Path alias misconfigured — tsconfig.json paths mapping is incorrect or missing.', likelihood: 0.25, testable: true, testAction: 'Read tsconfig.json and verify the paths/baseUrl configuration' },
        ],
    },
    {
        pattern: /TS2345.*Argument of type '(.+)' is not assignable to parameter/i,
        causes: [
            { explanation: 'Function argument type mismatch — the value passed does not match the parameter type.', likelihood: 0.8, testable: true, testAction: 'Read the function signature and compare with the argument being passed' },
            { explanation: 'Overload resolution failure — the function has multiple overloads and none match the provided arguments.', likelihood: 0.3, testable: true, testAction: 'Check all function overloads and find the correct signature to use' },
        ],
    },
    {
        pattern: /TS18046.*'(.+)' is of type 'unknown'/i,
        causes: [
            { explanation: 'Untyped catch clause — error in catch block is unknown by default in strict mode. Add a type assertion or type guard.', likelihood: 0.7, testable: true, testAction: 'Add `if (err instanceof Error)` guard or `as Error` assertion in the catch block' },
            { explanation: 'Untyped JSON parse — JSON.parse returns unknown. Add a type assertion or validation.', likelihood: 0.4, testable: true, testAction: 'Add a type assertion after JSON.parse or use a validation library like zod' },
        ],
    },
];
const RUNTIME_CAUSE_MAP = [
    {
        pattern: /TypeError:.*Cannot read propert(y|ies) of (null|undefined)/i,
        causes: [
            { explanation: 'Null reference — a variable is null/undefined when a property access was attempted. Check the data flow.', likelihood: 0.85, testable: true, testAction: 'Add console.log before the error line to trace which variable is null/undefined' },
            { explanation: 'Async timing issue — the data has not loaded yet when the code runs. Check for missing await or race condition.', likelihood: 0.45, testable: true, testAction: 'Check if the variable is populated asynchronously and ensure proper await/then handling' },
            { explanation: 'Incorrect API response shape — the API returned a different structure than expected.', likelihood: 0.3, testable: true, testAction: 'Log the raw API response and compare with the expected type' },
        ],
    },
    {
        pattern: /ReferenceError:.*is not defined/i,
        causes: [
            { explanation: 'Missing import or declaration — the variable/function is used but never imported or declared.', likelihood: 0.75, testable: true, testAction: 'Search the codebase for the definition and add the correct import' },
            { explanation: 'Scope issue — the variable is declared inside a block but accessed outside of it.', likelihood: 0.35, testable: true, testAction: 'Check the variable declaration scope and move it if necessary' },
            { explanation: 'Circular dependency — two modules import each other, causing one to be undefined at import time.', likelihood: 0.2, testable: true, testAction: 'Check the import chain for circular references using a dependency graph' },
        ],
    },
    {
        pattern: /SyntaxError:.*Unexpected token/i,
        causes: [
            { explanation: 'JSON parse error — attempted to parse invalid JSON (HTML error page, empty response, etc.).', likelihood: 0.6, testable: true, testAction: 'Log the raw string being parsed before the JSON.parse call' },
            { explanation: 'ESM/CJS mismatch — importing a CommonJS module with ESM syntax or vice versa.', likelihood: 0.4, testable: true, testAction: 'Check the module type in package.json and the file extension (.mjs vs .cjs vs .js)' },
            { explanation: 'Corrupted file — the source file has invalid syntax from a bad edit or encoding issue.', likelihood: 0.15, testable: true, testAction: 'Run the file through a linter or syntax checker' },
        ],
    },
    {
        pattern: /Error:.*ENOENT.*no such file or directory/i,
        causes: [
            { explanation: 'File path is wrong — the path references a file that does not exist. Check for typos.', likelihood: 0.7, testable: true, testAction: 'List the directory contents to see what files actually exist' },
            { explanation: 'Working directory is different than expected — the relative path resolves to the wrong location.', likelihood: 0.45, testable: true, testAction: 'Log process.cwd() and verify it matches expectations' },
            { explanation: 'File was deleted or moved — a previous operation removed the file.', likelihood: 0.2, testable: true, testAction: 'Check git status or recent file operations for the missing file' },
        ],
    },
    {
        pattern: /Error:.*EACCES.*permission denied/i,
        causes: [
            { explanation: 'File permission issue — the process does not have read/write access to the path.', likelihood: 0.75, testable: true, testAction: 'Check file permissions with ls -la and fix with chmod if needed' },
            { explanation: 'File is locked by another process — another application has an exclusive lock.', likelihood: 0.3, testable: true, testAction: 'Check for processes using the file with lsof or fuser' },
        ],
    },
    {
        pattern: /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/i,
        causes: [
            { explanation: 'Missing dependency — the npm package is not installed.', likelihood: 0.6, testable: true, testAction: 'Run npm install and verify the package is in node_modules' },
            { explanation: 'ESM import missing file extension — Node.js ESM requires explicit .js extensions in imports.', likelihood: 0.55, testable: true, testAction: 'Check the import statement and add .js extension if using ESM' },
            { explanation: 'Incorrect exports field — package.json exports map does not include the requested subpath.', likelihood: 0.25, testable: true, testAction: 'Check the package.json exports field of the target package' },
        ],
    },
    {
        pattern: /UnhandledPromiseRejection|unhandled promise/i,
        causes: [
            { explanation: 'Missing await — an async function call is not awaited, and its rejection is unhandled.', likelihood: 0.7, testable: true, testAction: 'Search for async function calls without await in the error context' },
            { explanation: 'Missing .catch() — a Promise chain lacks error handling.', likelihood: 0.5, testable: true, testAction: 'Add .catch() to the Promise chain or wrap in try/catch with await' },
            { explanation: 'Error in event handler — an async event callback throws and nothing catches it.', likelihood: 0.25, testable: true, testAction: 'Wrap the event handler body in try/catch' },
        ],
    },
    {
        pattern: /ECONNREFUSED|ECONNRESET|ETIMEDOUT/i,
        causes: [
            { explanation: 'Service not running — the target server/service is not started or has crashed.', likelihood: 0.65, testable: true, testAction: 'Check if the target service is running on the expected port' },
            { explanation: 'Wrong port or host — the connection URL is misconfigured.', likelihood: 0.4, testable: true, testAction: 'Verify the connection URL/port in config or environment variables' },
            { explanation: 'Firewall or network issue — a firewall rule or network configuration is blocking the connection.', likelihood: 0.2, testable: true, testAction: 'Try curl or ping to the target host to verify network connectivity' },
        ],
    },
    {
        pattern: /env|ENV|environment variable/i,
        causes: [
            { explanation: 'Missing environment variable — a required env var is not set.', likelihood: 0.7, testable: true, testAction: 'Check .env file and process.env for the required variable' },
            { explanation: 'Wrong .env file loaded — the application is loading a different .env file than expected.', likelihood: 0.3, testable: true, testAction: 'Verify which .env file is being loaded (check dotenv config path)' },
        ],
    },
];
const BUILD_CAUSE_MAP = [
    {
        pattern: /Cannot resolve|Module not found|Failed to resolve/i,
        causes: [
            { explanation: 'Missing dependency — a package referenced in the code is not installed.', likelihood: 0.6, testable: true, testAction: 'Run npm install and check package.json for the dependency' },
            { explanation: 'Incorrect import path — a relative or alias path does not resolve to a real file.', likelihood: 0.55, testable: true, testAction: 'Verify the import path and check vite/webpack alias configuration' },
            { explanation: 'Build config error — the bundler resolve configuration is misconfigured.', likelihood: 0.25, testable: true, testAction: 'Check vite.config.ts or webpack.config.js resolve section' },
        ],
    },
    {
        pattern: /out of memory|heap|allocation failed/i,
        causes: [
            { explanation: 'Node.js heap limit — the build process needs more memory. Increase --max-old-space-size.', likelihood: 0.7, testable: true, testAction: 'Set NODE_OPTIONS=--max-old-space-size=4096 and retry the build' },
            { explanation: 'Circular dependency causing infinite expansion — two modules create an import cycle that bloats the bundle.', likelihood: 0.35, testable: true, testAction: 'Use a circular dependency detector (madge) to find cycles' },
        ],
    },
    {
        pattern: /chunk|bundle|size|limit/i,
        causes: [
            { explanation: 'Bundle too large — a large dependency is being included. Use code splitting or dynamic imports.', likelihood: 0.6, testable: true, testAction: 'Run bundle analyzer (vite-bundle-visualizer) to identify large chunks' },
            { explanation: 'Tree-shaking not working — a dependency uses CommonJS and cannot be tree-shaken.', likelihood: 0.35, testable: true, testAction: 'Check if the dependency provides an ESM build' },
        ],
    },
];
const GIT_CAUSE_MAP = [
    {
        pattern: /CONFLICT|merge conflict|Automatic merge failed/i,
        causes: [
            { explanation: 'Merge conflict — two branches modified the same lines. Manual resolution required.', likelihood: 0.9, testable: true, testAction: 'Run git diff to see conflicting files and resolve the conflict markers' },
            { explanation: 'Rebase conflict — interactive rebase encountered overlapping changes.', likelihood: 0.3, testable: true, testAction: 'Run git status to see which files need resolution, then git rebase --continue' },
        ],
    },
    {
        pattern: /HEAD detached|detached HEAD/i,
        causes: [
            { explanation: 'Checked out a commit instead of a branch — HEAD is not on any branch.', likelihood: 0.8, testable: true, testAction: 'Run git branch to see available branches and git checkout <branch> to reattach' },
            { explanation: 'Rebase left HEAD detached — a rebase was interrupted or completed without re-attaching.', likelihood: 0.3, testable: true, testAction: 'Run git reflog to find the branch and git checkout <branch>' },
        ],
    },
    {
        pattern: /Permission denied|access denied|authentication failed/i,
        causes: [
            { explanation: 'SSH key not configured or expired — the SSH key for the remote is missing or invalid.', likelihood: 0.55, testable: true, testAction: 'Run ssh -T git@github.com to test SSH authentication' },
            { explanation: 'Token expired or missing — the personal access token or OAuth token needs refreshing.', likelihood: 0.5, testable: true, testAction: 'Check git config credential helper and re-authenticate' },
            { explanation: 'Repository permissions — you do not have push access to this repository.', likelihood: 0.3, testable: true, testAction: 'Check repository settings on GitHub to verify your access level' },
        ],
    },
    {
        pattern: /rejected.*non-fast-forward|Updates were rejected/i,
        causes: [
            { explanation: 'Remote has new commits — someone pushed changes you do not have locally. Pull first.', likelihood: 0.8, testable: true, testAction: 'Run git pull --rebase to integrate remote changes before pushing' },
            { explanation: 'Branch protection — the branch has protection rules that reject direct pushes.', likelihood: 0.3, testable: true, testAction: 'Check branch protection rules on GitHub and create a PR instead' },
        ],
    },
];
const ALL_CAUSE_MAPS = [
    ...TYPESCRIPT_CAUSE_MAP,
    ...RUNTIME_CAUSE_MAP,
    ...BUILD_CAUSE_MAP,
    ...GIT_CAUSE_MAP,
];
// ── Abductive state ──
let currentSession = null;
/**
 * Generate ranked hypotheses for an observed error or unexpected behavior.
 * Uses heuristic pattern matching against pre-built cause maps.
 */
export function generateHypotheses(observation, context) {
    const hypotheses = [];
    const combined = `${observation}\n${context}`;
    // Match against all cause maps
    for (const causePattern of ALL_CAUSE_MAPS) {
        if (causePattern.pattern.test(combined)) {
            for (const cause of causePattern.causes) {
                // Avoid duplicate explanations
                if (hypotheses.some(h => h.explanation === cause.explanation))
                    continue;
                hypotheses.push({
                    id: shortId(),
                    explanation: cause.explanation,
                    evidence: extractEvidence(observation, context, cause.explanation),
                    contradictions: [],
                    likelihood: cause.likelihood,
                    testable: cause.testable,
                    testAction: cause.testAction,
                });
            }
        }
    }
    // If no pattern matched, generate generic hypotheses from keywords
    if (hypotheses.length === 0) {
        hypotheses.push(...generateGenericHypotheses(observation, context));
    }
    // Sort by likelihood descending
    hypotheses.sort((a, b) => b.likelihood - a.likelihood);
    const result = {
        observation,
        hypotheses,
        recommended: hypotheses.length > 0 ? hypotheses[0].id : '',
    };
    currentSession = result;
    return result;
}
/**
 * Update hypothesis likelihoods after testing one.
 * If the test confirmed the hypothesis, boost it and reduce others.
 * If the test contradicted it, reduce it and boost alternatives.
 */
export function testHypothesis(id, result) {
    if (!currentSession)
        return;
    const hypothesis = currentSession.hypotheses.find(h => h.id === id);
    if (!hypothesis)
        return;
    const lowerResult = result.toLowerCase();
    const isConfirming = lowerResult.includes('confirmed') ||
        lowerResult.includes('found') ||
        lowerResult.includes('yes') ||
        lowerResult.includes('correct') ||
        lowerResult.includes('match') ||
        lowerResult.includes('success');
    const isContracting = lowerResult.includes('no') ||
        lowerResult.includes('not found') ||
        lowerResult.includes('wrong') ||
        lowerResult.includes('incorrect') ||
        lowerResult.includes('failed') ||
        lowerResult.includes('contradicted');
    if (isConfirming) {
        // Boost this hypothesis, reduce others proportionally
        hypothesis.likelihood = Math.min(1.0, hypothesis.likelihood + 0.25);
        hypothesis.evidence.push(result);
        for (const other of currentSession.hypotheses) {
            if (other.id !== id) {
                other.likelihood = Math.max(0.01, other.likelihood * 0.7);
            }
        }
    }
    else if (isContracting) {
        // Reduce this hypothesis, slightly boost others
        hypothesis.likelihood = Math.max(0.01, hypothesis.likelihood * 0.3);
        hypothesis.contradictions.push(result);
        for (const other of currentSession.hypotheses) {
            if (other.id !== id) {
                other.likelihood = Math.min(1.0, other.likelihood * 1.15);
            }
        }
    }
    else {
        // Ambiguous result — add as evidence but only mildly adjust
        hypothesis.evidence.push(result);
        hypothesis.likelihood = Math.min(1.0, hypothesis.likelihood * 1.05);
    }
    // Re-sort and update recommended
    currentSession.hypotheses.sort((a, b) => b.likelihood - a.likelihood);
    currentSession.recommended = currentSession.hypotheses[0]?.id ?? '';
}
/**
 * Eliminate a hypothesis with a reason. Sets its likelihood to near-zero.
 */
export function eliminateHypothesis(id, reason) {
    if (!currentSession)
        return;
    const hypothesis = currentSession.hypotheses.find(h => h.id === id);
    if (!hypothesis)
        return;
    hypothesis.likelihood = 0.0;
    hypothesis.contradictions.push(`ELIMINATED: ${reason}`);
    // Re-sort and update recommended (skip eliminated)
    currentSession.hypotheses.sort((a, b) => b.likelihood - a.likelihood);
    const best = currentSession.hypotheses.find(h => h.likelihood > 0);
    currentSession.recommended = best?.id ?? '';
}
/**
 * Get the current best explanation after testing.
 */
export function getBestExplanation() {
    if (!currentSession || currentSession.hypotheses.length === 0)
        return null;
    return currentSession.hypotheses.reduce((best, h) => h.likelihood > best.likelihood ? h : best);
}
// ── Abductive helpers ──
function extractEvidence(observation, context, _explanation) {
    const evidence = [];
    // Extract file paths mentioned
    const filePaths = observation.match(/(?:\/[\w./-]+|[\w./-]+\.\w{1,5})/g);
    if (filePaths) {
        evidence.push(`Files mentioned: ${[...new Set(filePaths)].join(', ')}`);
    }
    // Extract line numbers
    const lineNums = observation.match(/line\s+(\d+)/gi);
    if (lineNums) {
        evidence.push(`Line references: ${lineNums.join(', ')}`);
    }
    // Extract error codes
    const errorCodes = observation.match(/(?:TS|E)\d{4,}/g);
    if (errorCodes) {
        evidence.push(`Error codes: ${[...new Set(errorCodes)].join(', ')}`);
    }
    // Include truncated context as evidence
    if (context.length > 0) {
        const contextSnippet = context.length > 200 ? context.slice(0, 200) + '...' : context;
        evidence.push(`Context: ${contextSnippet}`);
    }
    return evidence;
}
function generateGenericHypotheses(observation, context) {
    const hypotheses = [];
    const combined = `${observation} ${context}`.toLowerCase();
    // Generic: configuration issue
    if (combined.includes('config') || combined.includes('setting') || combined.includes('.json') || combined.includes('.toml')) {
        hypotheses.push({
            id: shortId(),
            explanation: 'Configuration issue — a config file has an incorrect or missing value.',
            evidence: extractEvidence(observation, context, ''),
            contradictions: [],
            likelihood: 0.5,
            testable: true,
            testAction: 'Read the relevant config file and verify all required fields are present and correct',
        });
    }
    // Generic: version mismatch
    if (combined.includes('version') || combined.includes('upgrade') || combined.includes('deprecat')) {
        hypotheses.push({
            id: shortId(),
            explanation: 'Version mismatch — a dependency or tool version is incompatible.',
            evidence: extractEvidence(observation, context, ''),
            contradictions: [],
            likelihood: 0.45,
            testable: true,
            testAction: 'Check the version of the relevant dependency or tool and compare with requirements',
        });
    }
    // Generic: state corruption
    if (combined.includes('cache') || combined.includes('corrupt') || combined.includes('stale') || combined.includes('invalid state')) {
        hypotheses.push({
            id: shortId(),
            explanation: 'Stale cache or corrupted state — cached data is outdated or corrupted.',
            evidence: extractEvidence(observation, context, ''),
            contradictions: [],
            likelihood: 0.4,
            testable: true,
            testAction: 'Clear relevant caches (node_modules, .cache, build output) and retry',
        });
    }
    // Fallback: always include a generic "unknown cause" hypothesis
    if (hypotheses.length === 0) {
        hypotheses.push({
            id: shortId(),
            explanation: 'Unknown cause — the error does not match any known pattern. Gather more information.',
            evidence: extractEvidence(observation, context, ''),
            contradictions: [],
            likelihood: 0.3,
            testable: true,
            testAction: 'Read the source file at the error location and examine the surrounding code',
        });
    }
    return hypotheses;
}
const APPROACH_SIGNALS = [
    { keywords: ['rewrite', 'rebuild', 'from scratch', 'replace entirely'], riskLevel: 0.8, effortLevel: 0.9, reversibility: 0.3, complexity: 0.8 },
    { keywords: ['refactor', 'restructure', 'reorganize'], riskLevel: 0.5, effortLevel: 0.7, reversibility: 0.6, complexity: 0.6 },
    { keywords: ['patch', 'fix', 'hotfix', 'quick fix', 'band-aid'], riskLevel: 0.3, effortLevel: 0.2, reversibility: 0.9, complexity: 0.2 },
    { keywords: ['migrate', 'upgrade', 'move to', 'switch to'], riskLevel: 0.6, effortLevel: 0.7, reversibility: 0.4, complexity: 0.7 },
    { keywords: ['add', 'extend', 'enhance', 'augment'], riskLevel: 0.3, effortLevel: 0.5, reversibility: 0.7, complexity: 0.4 },
    { keywords: ['remove', 'delete', 'drop', 'deprecate'], riskLevel: 0.4, effortLevel: 0.3, reversibility: 0.5, complexity: 0.2 },
    { keywords: ['test', 'verify', 'validate', 'check'], riskLevel: 0.1, effortLevel: 0.3, reversibility: 1.0, complexity: 0.2 },
    { keywords: ['configure', 'config', 'setting', 'toggle'], riskLevel: 0.2, effortLevel: 0.2, reversibility: 0.9, complexity: 0.1 },
    { keywords: ['workaround', 'bypass', 'skip', 'ignore'], riskLevel: 0.5, effortLevel: 0.15, reversibility: 0.8, complexity: 0.15 },
    { keywords: ['new file', 'create', 'scaffold', 'generate'], riskLevel: 0.2, effortLevel: 0.5, reversibility: 0.8, complexity: 0.4 },
];
function analyzeApproach(description) {
    const lower = description.toLowerCase();
    let totalWeight = 0;
    let weightedRisk = 0;
    let weightedEffort = 0;
    let weightedReversibility = 0;
    let weightedComplexity = 0;
    for (const signal of APPROACH_SIGNALS) {
        const matchCount = signal.keywords.filter(kw => lower.includes(kw)).length;
        if (matchCount > 0) {
            const weight = matchCount;
            totalWeight += weight;
            weightedRisk += signal.riskLevel * weight;
            weightedEffort += signal.effortLevel * weight;
            weightedReversibility += signal.reversibility * weight;
            weightedComplexity += signal.complexity * weight;
        }
    }
    if (totalWeight === 0) {
        return { risk: 0.5, effort: 0.5, reversibility: 0.5, complexity: 0.5 };
    }
    return {
        risk: weightedRisk / totalWeight,
        effort: weightedEffort / totalWeight,
        reversibility: weightedReversibility / totalWeight,
        complexity: weightedComplexity / totalWeight,
    };
}
/**
 * Analyze an alternative approach without executing it.
 * Compares risk, effort, and reversibility of current vs alternative.
 */
export function exploreCounterfactual(currentApproach, alternative, context) {
    const currentAnalysis = analyzeApproach(currentApproach);
    const altAnalysis = analyzeApproach(alternative);
    const benefits = [];
    const risks = [];
    // Compare risk
    if (altAnalysis.risk < currentAnalysis.risk) {
        benefits.push(`Lower risk (${(altAnalysis.risk * 100).toFixed(0)}% vs ${(currentAnalysis.risk * 100).toFixed(0)}%)`);
    }
    else if (altAnalysis.risk > currentAnalysis.risk) {
        risks.push(`Higher risk (${(altAnalysis.risk * 100).toFixed(0)}% vs ${(currentAnalysis.risk * 100).toFixed(0)}%)`);
    }
    // Compare effort
    if (altAnalysis.effort < currentAnalysis.effort) {
        benefits.push(`Less effort (${(altAnalysis.effort * 100).toFixed(0)}% vs ${(currentAnalysis.effort * 100).toFixed(0)}%)`);
    }
    else if (altAnalysis.effort > currentAnalysis.effort) {
        risks.push(`More effort (${(altAnalysis.effort * 100).toFixed(0)}% vs ${(currentAnalysis.effort * 100).toFixed(0)}%)`);
    }
    // Compare reversibility
    if (altAnalysis.reversibility > currentAnalysis.reversibility) {
        benefits.push(`More reversible (${(altAnalysis.reversibility * 100).toFixed(0)}% vs ${(currentAnalysis.reversibility * 100).toFixed(0)}%)`);
    }
    else if (altAnalysis.reversibility < currentAnalysis.reversibility) {
        risks.push(`Less reversible (${(altAnalysis.reversibility * 100).toFixed(0)}% vs ${(currentAnalysis.reversibility * 100).toFixed(0)}%)`);
    }
    // Compare complexity
    if (altAnalysis.complexity < currentAnalysis.complexity) {
        benefits.push(`Simpler approach (${(altAnalysis.complexity * 100).toFixed(0)}% vs ${(currentAnalysis.complexity * 100).toFixed(0)}%)`);
    }
    else if (altAnalysis.complexity > currentAnalysis.complexity) {
        risks.push(`More complex (${(altAnalysis.complexity * 100).toFixed(0)}% vs ${(currentAnalysis.complexity * 100).toFixed(0)}%)`);
    }
    // Context-based signals
    const lowerContext = context.toLowerCase();
    if (lowerContext.includes('deadline') || lowerContext.includes('urgent') || lowerContext.includes('asap')) {
        if (altAnalysis.effort > currentAnalysis.effort) {
            risks.push('Time pressure makes higher-effort alternatives risky');
        }
        else {
            benefits.push('Faster approach aligns with time constraints');
        }
    }
    if (lowerContext.includes('production') || lowerContext.includes('live') || lowerContext.includes('deployed')) {
        if (altAnalysis.risk > 0.5) {
            risks.push('High-risk changes in production environment');
        }
        if (altAnalysis.reversibility > 0.7) {
            benefits.push('Easily reversible — safe for production');
        }
    }
    // Determine effort comparison
    const effortDiff = altAnalysis.effort - currentAnalysis.effort;
    const effort = effortDiff < -0.1 ? 'less' : effortDiff > 0.1 ? 'more' : 'same';
    // Make recommendation
    const benefitScore = benefits.length;
    const riskScore = risks.length;
    let recommendation;
    let reasoning;
    if (benefitScore > riskScore + 1) {
        recommendation = 'switch';
        reasoning = `The alternative approach has ${benefitScore} benefits vs ${riskScore} risks. The net advantage is clear.`;
    }
    else if (riskScore > benefitScore + 1) {
        recommendation = 'stay';
        reasoning = `The alternative approach has ${riskScore} risks vs ${benefitScore} benefits. Staying with the current approach is safer.`;
    }
    else {
        recommendation = 'defer';
        reasoning = `The tradeoffs are roughly balanced (${benefitScore} benefits, ${riskScore} risks). Consider gathering more information before deciding.`;
    }
    return {
        id: shortId(),
        scenario: `What if we used "${alternative}" instead of "${currentApproach}"?`,
        currentPath: currentApproach,
        alternativePath: alternative,
        tradeoffs: { benefits, risks, effort },
        recommendation,
        reasoning,
    };
}
/**
 * Compare multiple alternative approaches.
 */
export function compareApproaches(approaches) {
    if (approaches.length < 2)
        return [];
    const results = [];
    const baseline = approaches[0];
    for (let i = 1; i < approaches.length; i++) {
        results.push(exploreCounterfactual(baseline, approaches[i], ''));
    }
    return results;
}
/**
 * Given current progress and obstacles, determine if we should pivot to a different approach.
 */
export function shouldPivot(currentProgress, obstacles) {
    const lowerProgress = currentProgress.toLowerCase();
    const allObstacles = obstacles.join(' ').toLowerCase();
    // Heuristic 1: Blocked 2+ times on same issue
    const obstacleCounts = new Map();
    for (const obstacle of obstacles) {
        // Normalize obstacle to a rough category
        const key = categorizeObstacle(obstacle);
        obstacleCounts.set(key, (obstacleCounts.get(key) ?? 0) + 1);
    }
    const repeatedBlocks = [...obstacleCounts.entries()].filter(([_, count]) => count >= 2);
    if (repeatedBlocks.length > 0) {
        const [category] = repeatedBlocks[0];
        return {
            pivot: true,
            to: suggestPivotTarget(category),
            reason: `Blocked ${repeatedBlocks[0][1]} times on ${category}. Repeated failures on the same issue suggest the current approach has a fundamental problem.`,
        };
    }
    // Heuristic 2: Cost exceeds 2x estimate (inferred from obstacle mentions)
    if (allObstacles.includes('over budget') || allObstacles.includes('too expensive') || allObstacles.includes('cost') || allObstacles.includes('2x')) {
        return {
            pivot: true,
            to: 'a simpler approach with fewer steps',
            reason: 'Cost has exceeded estimates. A simpler approach would reduce total expense.',
        };
    }
    // Heuristic 3: If >50% done, stay unless critical
    if (lowerProgress.includes('50%') || lowerProgress.includes('half') || lowerProgress.includes('halfway') ||
        lowerProgress.includes('most done') || lowerProgress.includes('nearly') || lowerProgress.includes('almost')) {
        const hasCritical = allObstacles.includes('critical') || allObstacles.includes('blocker') ||
            allObstacles.includes('impossible') || allObstacles.includes('cannot');
        if (!hasCritical) {
            return {
                pivot: false,
                reason: 'Significant progress has been made. The obstacles are not critical, so staying the course is more efficient than starting over.',
            };
        }
    }
    // Heuristic 4: Multiple diverse obstacles suggest fundamental issue
    if (obstacles.length >= 3) {
        const categories = new Set(obstacles.map(categorizeObstacle));
        if (categories.size >= 3) {
            return {
                pivot: true,
                to: 'a research-first approach to understand the problem space before attempting implementation',
                reason: `${obstacles.length} obstacles across ${categories.size} different categories suggest insufficient understanding of the problem. Research first.`,
            };
        }
    }
    // Default: don't pivot
    return {
        pivot: false,
        reason: 'Current obstacles do not indicate a fundamental problem with the approach. Continue with the current plan.',
    };
}
function categorizeObstacle(obstacle) {
    const lower = obstacle.toLowerCase();
    if (lower.includes('type') || lower.includes('typescript') || lower.includes('ts'))
        return 'type-system';
    if (lower.includes('import') || lower.includes('module') || lower.includes('require'))
        return 'module-resolution';
    if (lower.includes('permission') || lower.includes('access') || lower.includes('auth'))
        return 'permissions';
    if (lower.includes('network') || lower.includes('timeout') || lower.includes('connection'))
        return 'network';
    if (lower.includes('config') || lower.includes('setting') || lower.includes('env'))
        return 'configuration';
    if (lower.includes('test') || lower.includes('assert') || lower.includes('expect'))
        return 'testing';
    if (lower.includes('build') || lower.includes('compile') || lower.includes('bundle'))
        return 'build';
    if (lower.includes('dependency') || lower.includes('package') || lower.includes('npm'))
        return 'dependencies';
    if (lower.includes('git') || lower.includes('merge') || lower.includes('conflict'))
        return 'version-control';
    return 'general';
}
function suggestPivotTarget(obstacleCategory) {
    const pivotSuggestions = {
        'type-system': 'using explicit type assertions or a simpler type structure to bypass the type system complexity',
        'module-resolution': 'restructuring imports or using a different module format (CJS vs ESM)',
        'permissions': 'running with elevated permissions or changing the file ownership approach',
        'network': 'using a local fallback or cached data instead of relying on network calls',
        'configuration': 'simplifying the configuration or using sensible defaults instead of complex config',
        'testing': 'writing the implementation first with manual testing, then adding automated tests',
        'build': 'simplifying the build pipeline or using a different bundler',
        'dependencies': 'reducing external dependencies or vendoring the problematic package',
        'version-control': 'creating a clean branch from main and cherry-picking only the needed changes',
        'general': 'a different approach that avoids the recurring obstacle',
    };
    return pivotSuggestions[obstacleCategory] ?? pivotSuggestions['general'];
}
// ── Pre-built strategies ──
const STRATEGIES = [
    {
        name: 'divide-and-conquer',
        description: 'Break the task into independent subtasks that can be worked on in parallel or sequence.',
        when: 'Complex tasks with multiple independent components.',
        steps: [
            'Identify all major components of the task',
            'Find dependencies between components',
            'Group independent components for parallel work',
            'Execute each group, verify before moving to dependent groups',
            'Integration test after all components are complete',
        ],
    },
    {
        name: 'incremental',
        description: 'Make small changes one at a time, verifying after each step.',
        when: 'High-risk changes or unfamiliar codebases where mistakes are costly.',
        steps: [
            'Identify the smallest meaningful change',
            'Implement that single change',
            'Verify it works (type-check, test, manual check)',
            'Commit/checkpoint the working state',
            'Repeat with the next smallest change',
        ],
    },
    {
        name: 'prototype-first',
        description: 'Build a quick and dirty version first, then refine into production quality.',
        when: 'Time pressure, or when the design is unclear and needs exploration.',
        steps: [
            'Build the simplest version that demonstrates the concept',
            'Test with real data to validate the approach',
            'Identify gaps and edge cases from the prototype',
            'Refactor into production-quality code',
            'Add error handling, types, and tests',
        ],
    },
    {
        name: 'research-first',
        description: 'Gather information and understand the problem space before taking any action.',
        when: 'High uncertainty — unfamiliar APIs, libraries, or problem domains.',
        steps: [
            'Read relevant documentation and source code',
            'Find examples of similar implementations',
            'Identify potential approaches and their tradeoffs',
            'Choose the best approach based on evidence',
            'Implement with confidence from research',
        ],
    },
    {
        name: 'test-driven',
        description: 'Write tests first that define the desired behavior, then implement to pass them.',
        when: 'Well-defined requirements, existing test infrastructure, or when correctness is critical.',
        steps: [
            'Understand the requirements and edge cases',
            'Write failing tests that capture the expected behavior',
            'Implement the minimum code to pass each test',
            'Refactor while keeping tests green',
            'Add integration tests if needed',
        ],
    },
    {
        name: 'surgical',
        description: 'Make the absolute minimum change needed. Precision over completeness.',
        when: 'Bug fixes, hotfixes, or changes to fragile/critical code.',
        steps: [
            'Identify the exact location of the issue',
            'Understand the surrounding code and its constraints',
            'Make the smallest possible change to fix the issue',
            'Verify nothing else was affected',
            'Document why this minimal approach was chosen',
        ],
    },
];
function scoreStrategies(task, context) {
    const combined = `${task} ${context}`.toLowerCase();
    const scores = STRATEGIES.map(s => ({ strategy: s.name, score: 0, reasons: [] }));
    function boost(name, amount, reason) {
        const entry = scores.find(s => s.strategy === name);
        if (entry) {
            entry.score += amount;
            entry.reasons.push(reason);
        }
    }
    // ── Complexity signals → divide-and-conquer
    if (combined.includes('multiple') || combined.includes('several') || combined.includes('many')) {
        boost('divide-and-conquer', 3, 'Multiple components detected');
    }
    if (combined.includes('parallel') || combined.includes('independent')) {
        boost('divide-and-conquer', 2, 'Independent subtasks mentioned');
    }
    if ((combined.match(/\band\b/g) ?? []).length >= 3) {
        boost('divide-and-conquer', 2, 'Task description lists multiple goals');
    }
    // ── Risk signals → incremental
    if (combined.includes('careful') || combined.includes('cautious') || combined.includes('fragile')) {
        boost('incremental', 3, 'Risk-averse signals detected');
    }
    if (combined.includes('production') || combined.includes('live') || combined.includes('deployed')) {
        boost('incremental', 2, 'Production environment — minimize risk');
    }
    if (combined.includes('unfamiliar') || combined.includes('new codebase') || combined.includes('legacy')) {
        boost('incremental', 2, 'Unfamiliar code — verify each step');
    }
    // ── Time pressure → prototype-first
    if (combined.includes('quick') || combined.includes('fast') || combined.includes('urgent') || combined.includes('asap')) {
        boost('prototype-first', 3, 'Time pressure detected');
    }
    if (combined.includes('prototype') || combined.includes('poc') || combined.includes('proof of concept')) {
        boost('prototype-first', 4, 'Explicitly requested prototype');
    }
    if (combined.includes('explore') || combined.includes('experiment') || combined.includes('try')) {
        boost('prototype-first', 2, 'Exploratory intent detected');
    }
    // ── Uncertainty signals → research-first
    if (combined.includes('how to') || combined.includes('not sure') || combined.includes('don\'t know')) {
        boost('research-first', 3, 'Uncertainty expressed');
    }
    if (combined.includes('api') || combined.includes('library') || combined.includes('documentation')) {
        boost('research-first', 2, 'External API/library involved');
    }
    if (combined.includes('new') || combined.includes('unfamiliar') || combined.includes('first time')) {
        boost('research-first', 2, 'New territory — research first');
    }
    // ── Test signals → test-driven
    if (combined.includes('test') || combined.includes('spec') || combined.includes('assert')) {
        boost('test-driven', 3, 'Testing explicitly mentioned');
    }
    if (combined.includes('correct') || combined.includes('reliable') || combined.includes('robust')) {
        boost('test-driven', 2, 'Correctness is a priority');
    }
    if (combined.includes('regression') || combined.includes('broke') || combined.includes('broken again')) {
        boost('test-driven', 3, 'Regression concern — tests prevent recurrence');
    }
    // ── Precision signals → surgical
    if (combined.includes('bug') || combined.includes('fix') || combined.includes('hotfix') || combined.includes('patch')) {
        boost('surgical', 3, 'Bug fix — minimal change preferred');
    }
    if (combined.includes('one line') || combined.includes('small change') || combined.includes('tiny')) {
        boost('surgical', 3, 'Small scope — surgical precision');
    }
    if (combined.includes('critical') || combined.includes('breaking') || combined.includes('blocker')) {
        boost('surgical', 2, 'Critical issue — precise fix needed');
    }
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    return scores;
}
/**
 * Choose the best planning strategy for a task.
 */
export function selectStrategy(task, context) {
    const scores = scoreStrategies(task, context);
    const best = scores[0];
    const fallback = scores[1];
    // Check if the top strategy is a clear winner (>= 2 points ahead of runner-up)
    const isClean = best.score - (fallback?.score ?? 0) >= 2;
    const adaptations = [];
    // Adapt the chosen strategy based on context
    const combined = `${task} ${context}`.toLowerCase();
    if (combined.includes('deadline') && best.strategy !== 'prototype-first') {
        adaptations.push('Time constraint detected — consider shortening verification steps');
    }
    if (combined.includes('production') && best.strategy === 'prototype-first') {
        adaptations.push('Production environment — add extra verification before deploying prototype');
    }
    if ((combined.includes('large') || combined.includes('big') || combined.includes('massive')) && best.strategy === 'surgical') {
        adaptations.push('Large scope detected — may need to expand from surgical to incremental if more changes surface');
    }
    return {
        chosenStrategy: best.strategy,
        reasoning: isClean
            ? `Chose "${best.strategy}" (score: ${best.score}). ${best.reasons.join('. ')}.`
            : `Chose "${best.strategy}" (score: ${best.score}) over "${fallback?.strategy}" (score: ${fallback?.score ?? 0}). The signals are close — monitor and adapt. ${best.reasons.join('. ')}.`,
        adaptations,
        fallbackStrategy: fallback?.strategy ?? 'incremental',
    };
}
/**
 * Evaluate whether the current planning strategy is working.
 */
export function evaluateStrategy(strategy, progress) {
    const lower = progress.toLowerCase();
    const strategyDef = STRATEGIES.find(s => s.name === strategy);
    // Positive signals
    const positiveSignals = [
        'completed', 'done', 'success', 'working', 'passed', 'verified', 'green',
        'progress', 'advancing', 'making headway',
    ];
    const positiveCount = positiveSignals.filter(s => lower.includes(s)).length;
    // Negative signals
    const negativeSignals = [
        'failed', 'error', 'blocked', 'stuck', 'broken', 'regression', 'timeout',
        'impossible', 'cannot', 'doesn\'t work', 'not working',
    ];
    const negativeCount = negativeSignals.filter(s => lower.includes(s)).length;
    if (negativeCount > positiveCount + 1) {
        // Strategy is not working — suggest switching
        let suggestion;
        switch (strategy) {
            case 'divide-and-conquer':
                suggestion = 'Components may be more coupled than expected. Try "incremental" to make one small change at a time.';
                break;
            case 'incremental':
                suggestion = 'Incremental changes keep failing. Try "research-first" to better understand the problem before more changes.';
                break;
            case 'prototype-first':
                suggestion = 'Prototype is hitting too many issues. Try "research-first" or "incremental" for a more careful approach.';
                break;
            case 'research-first':
                suggestion = 'Research is not leading to actionable steps. Try "prototype-first" to learn by doing.';
                break;
            case 'test-driven':
                suggestion = 'Tests are hard to write for this domain. Try "prototype-first" to discover the right interface, then add tests.';
                break;
            case 'surgical':
                suggestion = 'The fix is more involved than expected. Try "incremental" to make broader changes safely.';
                break;
            default:
                suggestion = 'Consider switching to "incremental" for a safe, step-by-step approach.';
        }
        return { working: false, suggestion };
    }
    if (positiveCount > negativeCount) {
        return { working: true };
    }
    // Neutral — keep going but note the uncertainty
    return {
        working: true,
        suggestion: strategyDef
            ? `Progress is unclear. Continue with "${strategy}" but be ready to switch to "${strategy === 'incremental' ? 'research-first' : 'incremental'}" if obstacles persist.`
            : undefined,
    };
}
/**
 * Adapt the current strategy when encountering a problem.
 */
export function adaptStrategy(currentStrategy, problem) {
    // Use the problem description to find a better strategy
    const result = selectStrategy(problem, `currently using ${currentStrategy} but encountering issues`);
    // If we'd pick the same strategy, suggest the fallback instead
    if (result.chosenStrategy === currentStrategy) {
        const strategies = scoreStrategies(problem, '');
        const alternative = strategies.find(s => s.strategy !== currentStrategy);
        if (alternative) {
            return {
                chosenStrategy: alternative.strategy,
                reasoning: `Current strategy "${currentStrategy}" is not working for this problem. Switching to "${alternative.strategy}". ${alternative.reasons.join('. ')}.`,
                adaptations: [`Adapted from "${currentStrategy}" due to: ${problem}`],
                fallbackStrategy: currentStrategy, // can always go back
            };
        }
    }
    result.adaptations.push(`Adapted from "${currentStrategy}" due to: ${problem}`);
    return result;
}
const STRATEGY_FILE = join(kbotDir(), 'strategies.json');
/**
 * Record which strategy worked for a task type for future reference.
 */
export function recordStrategyOutcome(taskType, strategy, outcome) {
    const history = loadJson(STRATEGY_FILE, []);
    history.push({
        taskType,
        strategy,
        outcome,
        timestamp: new Date().toISOString(),
    });
    // Keep last 200 entries
    const trimmed = history.slice(-200);
    saveJson(STRATEGY_FILE, trimmed);
}
/**
 * Get the historically best strategy for a given task type.
 */
export function getHistoricalBestStrategy(taskType) {
    const history = loadJson(STRATEGY_FILE, []);
    const relevant = history.filter(h => h.taskType === taskType);
    if (relevant.length === 0)
        return null;
    // Count successes per strategy
    const counts = new Map();
    for (const entry of relevant) {
        const existing = counts.get(entry.strategy) ?? { success: 0, total: 0 };
        existing.total++;
        if (entry.outcome === 'success')
            existing.success++;
        counts.set(entry.strategy, existing);
    }
    // Find highest success rate (minimum 2 uses)
    let bestStrategy = null;
    let bestRate = 0;
    for (const [strategy, data] of counts) {
        if (data.total >= 2) {
            const rate = data.success / data.total;
            if (rate > bestRate) {
                bestRate = rate;
                bestStrategy = strategy;
            }
        }
    }
    return bestStrategy;
}
// ════════════════════════════════════════════════════════════════════════════
// TOOL REGISTRATION
// ════════════════════════════════════════════════════════════════════════════
export function registerReasoningTools() {
    // ── Tool 1: hypothesize ──
    registerTool({
        name: 'hypothesize',
        description: 'Generate ranked hypotheses for an error or unexpected behavior using abductive reasoning. ' +
            'Given an observation (error message, unexpected output, etc.) and optional context, ' +
            'returns a ranked list of possible explanations with evidence, test actions, and likelihoods. ' +
            'Use this when debugging to systematically explore possible root causes.',
        parameters: {
            observation: {
                type: 'string',
                description: 'The error message, unexpected behavior, or symptom to diagnose',
                required: true,
            },
            context: {
                type: 'string',
                description: 'Additional context: file paths, recent changes, stack trace, etc.',
            },
            action: {
                type: 'string',
                description: 'Action to take: "generate" (default), "test" (update after testing), "eliminate" (rule out), "best" (get current best)',
            },
            hypothesis_id: {
                type: 'string',
                description: 'Hypothesis ID (required for "test" and "eliminate" actions)',
            },
            result: {
                type: 'string',
                description: 'Test result or elimination reason (required for "test" and "eliminate" actions)',
            },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action ?? 'generate');
            const observation = String(args.observation ?? '');
            const context = String(args.context ?? '');
            switch (action) {
                case 'generate': {
                    if (!observation)
                        return 'Error: observation is required for generating hypotheses';
                    const result = generateHypotheses(observation, context);
                    return formatAbductiveResult(result);
                }
                case 'test': {
                    const id = String(args.hypothesis_id ?? '');
                    const testResult = String(args.result ?? '');
                    if (!id || !testResult)
                        return 'Error: hypothesis_id and result are required for testing';
                    testHypothesis(id, testResult);
                    if (!currentSession)
                        return 'Error: no active hypothesis session. Generate hypotheses first.';
                    return formatAbductiveResult(currentSession);
                }
                case 'eliminate': {
                    const id = String(args.hypothesis_id ?? '');
                    const reason = String(args.result ?? '');
                    if (!id || !reason)
                        return 'Error: hypothesis_id and result (reason) are required for elimination';
                    eliminateHypothesis(id, reason);
                    if (!currentSession)
                        return 'Error: no active hypothesis session. Generate hypotheses first.';
                    return formatAbductiveResult(currentSession);
                }
                case 'best': {
                    const best = getBestExplanation();
                    if (!best)
                        return 'No hypotheses available. Generate hypotheses first.';
                    return `Best explanation (${(best.likelihood * 100).toFixed(0)}% likelihood):\n` +
                        `  ${best.explanation}\n` +
                        `  Evidence: ${best.evidence.join('; ')}\n` +
                        `  Test: ${best.testAction}`;
                }
                default:
                    return `Unknown action: ${action}. Use "generate", "test", "eliminate", or "best".`;
            }
        },
    });
    // ── Tool 2: counterfactual ──
    registerTool({
        name: 'counterfactual',
        description: 'Explore alternative approaches without executing them using counterfactual thinking. ' +
            'Compare the current approach against alternatives to understand tradeoffs in risk, effort, ' +
            'reversibility, and complexity. Also determines whether to pivot based on current obstacles. ' +
            'Use this when stuck or before committing to a potentially costly approach.',
        parameters: {
            current_approach: {
                type: 'string',
                description: 'Description of the current approach being taken',
                required: true,
            },
            alternative: {
                type: 'string',
                description: 'Description of the alternative approach to evaluate',
            },
            alternatives: {
                type: 'string',
                description: 'Comma-separated list of alternatives to compare (used with action "compare")',
            },
            context: {
                type: 'string',
                description: 'Additional context: deadlines, environment, constraints',
            },
            action: {
                type: 'string',
                description: 'Action: "explore" (default), "compare" (multiple alternatives), "pivot" (should we switch?)',
            },
            obstacles: {
                type: 'string',
                description: 'Comma-separated list of obstacles encountered (used with action "pivot")',
            },
            progress: {
                type: 'string',
                description: 'Description of current progress (used with action "pivot")',
            },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action ?? 'explore');
            const currentApproach = String(args.current_approach ?? '');
            const context = String(args.context ?? '');
            switch (action) {
                case 'explore': {
                    const alternative = String(args.alternative ?? '');
                    if (!currentApproach || !alternative)
                        return 'Error: current_approach and alternative are required';
                    const result = exploreCounterfactual(currentApproach, alternative, context);
                    return formatCounterfactual(result);
                }
                case 'compare': {
                    const alts = String(args.alternatives ?? '');
                    if (!currentApproach || !alts)
                        return 'Error: current_approach and alternatives are required';
                    const approaches = [currentApproach, ...alts.split(',').map(s => s.trim()).filter(Boolean)];
                    const results = compareApproaches(approaches);
                    if (results.length === 0)
                        return 'Error: need at least 2 approaches to compare';
                    return results.map((r, i) => `--- Alternative ${i + 1} ---\n${formatCounterfactual(r)}`).join('\n\n');
                }
                case 'pivot': {
                    const progress = String(args.progress ?? currentApproach);
                    const obstaclesStr = String(args.obstacles ?? '');
                    const obstacles = obstaclesStr.split(',').map(s => s.trim()).filter(Boolean);
                    if (obstacles.length === 0)
                        return 'Error: obstacles are required for pivot analysis';
                    const result = shouldPivot(progress, obstacles);
                    return `Pivot decision: ${result.pivot ? 'YES — PIVOT' : 'NO — STAY THE COURSE'}\n` +
                        (result.to ? `Suggested pivot: ${result.to}\n` : '') +
                        `Reasoning: ${result.reason}`;
                }
                default:
                    return `Unknown action: ${action}. Use "explore", "compare", or "pivot".`;
            }
        },
    });
    // ── Tool 3: meta_plan ──
    registerTool({
        name: 'meta_plan',
        description: 'Choose or adapt the planning strategy for a task using meta-planning. ' +
            'Analyzes the task characteristics (complexity, risk, uncertainty, time pressure) ' +
            'to recommend the best planning approach: divide-and-conquer, incremental, prototype-first, ' +
            'research-first, test-driven, or surgical. Can also evaluate and adapt strategies mid-execution. ' +
            'Use this at the start of complex tasks or when the current approach is failing.',
        parameters: {
            task: {
                type: 'string',
                description: 'Description of the task to plan for',
                required: true,
            },
            context: {
                type: 'string',
                description: 'Additional context: codebase state, constraints, past attempts',
            },
            action: {
                type: 'string',
                description: 'Action: "select" (default), "evaluate" (is strategy working?), "adapt" (switch strategy), "history" (past results), "record" (save outcome)',
            },
            current_strategy: {
                type: 'string',
                description: 'Name of the current strategy (required for "evaluate" and "adapt")',
            },
            progress: {
                type: 'string',
                description: 'Description of progress so far (required for "evaluate")',
            },
            problem: {
                type: 'string',
                description: 'Description of the problem encountered (required for "adapt")',
            },
            task_type: {
                type: 'string',
                description: 'Category of the task (used for "history" and "record")',
            },
            outcome: {
                type: 'string',
                description: 'Outcome of the strategy: "success", "failure", or "partial" (used for "record")',
            },
        },
        tier: 'free',
        async execute(args) {
            const action = String(args.action ?? 'select');
            const task = String(args.task ?? '');
            const context = String(args.context ?? '');
            switch (action) {
                case 'select': {
                    if (!task)
                        return 'Error: task description is required';
                    // Check historical data first
                    const taskType = String(args.task_type ?? '');
                    if (taskType) {
                        const historicalBest = getHistoricalBestStrategy(taskType);
                        if (historicalBest) {
                            const result = selectStrategy(task, context);
                            return `Historical recommendation for "${taskType}": ${historicalBest}\n\n` +
                                `Current analysis:\n${formatMetaPlanResult(result)}`;
                        }
                    }
                    const result = selectStrategy(task, context);
                    return formatMetaPlanResult(result);
                }
                case 'evaluate': {
                    const strategy = String(args.current_strategy ?? '');
                    const progress = String(args.progress ?? '');
                    if (!strategy || !progress)
                        return 'Error: current_strategy and progress are required';
                    const result = evaluateStrategy(strategy, progress);
                    return `Strategy "${strategy}" evaluation: ${result.working ? 'WORKING' : 'NOT WORKING'}` +
                        (result.suggestion ? `\nSuggestion: ${result.suggestion}` : '');
                }
                case 'adapt': {
                    const strategy = String(args.current_strategy ?? '');
                    const problem = String(args.problem ?? '');
                    if (!strategy || !problem)
                        return 'Error: current_strategy and problem are required';
                    const result = adaptStrategy(strategy, problem);
                    return `Adapting from "${strategy}":\n${formatMetaPlanResult(result)}`;
                }
                case 'history': {
                    const taskType = String(args.task_type ?? '');
                    if (!taskType)
                        return 'Error: task_type is required for history lookup';
                    const best = getHistoricalBestStrategy(taskType);
                    return best
                        ? `Best historical strategy for "${taskType}": ${best}`
                        : `No historical data for "${taskType}" yet (need at least 2 recorded outcomes).`;
                }
                case 'record': {
                    const taskType = String(args.task_type ?? '');
                    const strategy = String(args.current_strategy ?? '');
                    const outcome = String(args.outcome ?? '');
                    if (!taskType || !strategy || !outcome)
                        return 'Error: task_type, current_strategy, and outcome are required';
                    if (!['success', 'failure', 'partial'].includes(outcome))
                        return 'Error: outcome must be "success", "failure", or "partial"';
                    recordStrategyOutcome(taskType, strategy, outcome);
                    return `Recorded: strategy "${strategy}" for task type "${taskType}" → ${outcome}`;
                }
                default:
                    return `Unknown action: ${action}. Use "select", "evaluate", "adapt", "history", or "record".`;
            }
        },
    });
}
// ════════════════════════════════════════════════════════════════════════════
// FORMATTING HELPERS
// ════════════════════════════════════════════════════════════════════════════
function formatAbductiveResult(result) {
    const lines = [
        `Observation: ${result.observation}`,
        `Hypotheses (${result.hypotheses.length}):`,
        '',
    ];
    for (const h of result.hypotheses) {
        const marker = h.id === result.recommended ? ' ◀ RECOMMENDED' : '';
        const eliminated = h.likelihood === 0 ? ' [ELIMINATED]' : '';
        lines.push(`  [${h.id}] ${(h.likelihood * 100).toFixed(0)}% — ${h.explanation}${marker}${eliminated}`);
        if (h.evidence.length > 0) {
            lines.push(`    Evidence: ${h.evidence.slice(0, 3).join('; ')}`);
        }
        if (h.contradictions.length > 0) {
            lines.push(`    Contradictions: ${h.contradictions.join('; ')}`);
        }
        if (h.testable) {
            lines.push(`    Test: ${h.testAction}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
function formatCounterfactual(cf) {
    const lines = [
        `Scenario: ${cf.scenario}`,
        `Current: ${cf.currentPath}`,
        `Alternative: ${cf.alternativePath}`,
        '',
        'Tradeoffs:',
        `  Effort: ${cf.tradeoffs.effort}`,
    ];
    if (cf.tradeoffs.benefits.length > 0) {
        lines.push(`  Benefits:`);
        for (const b of cf.tradeoffs.benefits)
            lines.push(`    + ${b}`);
    }
    if (cf.tradeoffs.risks.length > 0) {
        lines.push(`  Risks:`);
        for (const r of cf.tradeoffs.risks)
            lines.push(`    - ${r}`);
    }
    lines.push('');
    lines.push(`Recommendation: ${cf.recommendation.toUpperCase()}`);
    lines.push(`Reasoning: ${cf.reasoning}`);
    return lines.join('\n');
}
function formatMetaPlanResult(result) {
    const strategy = STRATEGIES.find(s => s.name === result.chosenStrategy);
    const lines = [
        `Strategy: ${result.chosenStrategy}`,
        `Reasoning: ${result.reasoning}`,
        `Fallback: ${result.fallbackStrategy}`,
    ];
    if (strategy) {
        lines.push('');
        lines.push(`Description: ${strategy.description}`);
        lines.push(`Best when: ${strategy.when}`);
        lines.push('Steps:');
        for (const [i, step] of strategy.steps.entries()) {
            lines.push(`  ${i + 1}. ${step}`);
        }
    }
    if (result.adaptations.length > 0) {
        lines.push('');
        lines.push('Adaptations:');
        for (const a of result.adaptations)
            lines.push(`  * ${a}`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=reasoning.js.map