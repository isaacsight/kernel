// kbot bench — Self-evaluation and benchmarking system
// Runs standardized coding tasks and scores kbot's performance
//
// Usage:
//   kbot bench                     # Run all benchmarks
//   kbot bench --category codegen  # Run only code generation tasks
//   kbot bench --difficulty hard   # Run only hard tasks
//   kbot bench --compare           # Compare last two runs
//   kbot bench --history           # Show all past runs
//
// Scoring (per task):
//   Pattern match (50%) — how many expected regex patterns the response matched
//   Tool usage   (30%) — whether correct tools were invoked
//   Speed        (20%) — response time relative to timeout budget
//
// Results saved to ~/.kbot/bench/ as timestamped JSON files.
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import chalk from 'chalk';
import { runAgent } from './agent.js';
import { getByokProvider, getProviderModel } from './auth.js';
import { createRequire } from 'node:module';
const __require = createRequire(import.meta.url);
const VERSION = __require('../package.json').version;
// ── Paths ──
const BENCH_DIR = join(homedir(), '.kbot', 'bench');
function ensureBenchDir() {
    if (!existsSync(BENCH_DIR))
        mkdirSync(BENCH_DIR, { recursive: true });
}
// ── Benchmark Tasks (20 tasks across 6 categories) ──
const BENCH_TASKS = [
    // ── Code Generation (5 tasks) ──
    {
        id: 'codegen-fibonacci',
        category: 'codegen',
        difficulty: 'easy',
        prompt: 'Write a TypeScript function called `fibonacci(n: number): number` that returns the nth Fibonacci number. Use memoization for O(n) performance. Include the function signature and implementation only.',
        expectedPatterns: [
            'function\\s+fibonacci',
            'number\\s*\\)',
            '(memo|cache|Map|Record|\\{\\})',
            'return',
        ],
        maxTokens: 500,
        timeoutMs: 15000,
    },
    {
        id: 'codegen-debounce',
        category: 'codegen',
        difficulty: 'medium',
        prompt: 'Write a TypeScript debounce function with this signature: `function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number): T`. It should cancel pending invocations when called again within the delay window. Return the implementation.',
        expectedPatterns: [
            'function\\s+debounce',
            'setTimeout',
            'clearTimeout',
            'delayMs|delay|ms|wait',
        ],
        maxTokens: 600,
        timeoutMs: 20000,
    },
    {
        id: 'codegen-lru-cache',
        category: 'codegen',
        difficulty: 'hard',
        prompt: 'Implement an LRU (Least Recently Used) cache in TypeScript with O(1) get and put operations. The class should be `LRUCache<K, V>` with constructor `(capacity: number)`, `get(key: K): V | undefined`, and `put(key: K, value: V): void`. Use a Map for O(1) lookups.',
        expectedPatterns: [
            'class\\s+LRUCache',
            'capacity',
            'get\\s*\\(',
            'put\\s*\\(',
            'Map|map',
            'delete|remove',
        ],
        maxTokens: 1000,
        timeoutMs: 30000,
    },
    {
        id: 'codegen-promise-all',
        category: 'codegen',
        difficulty: 'medium',
        prompt: 'Implement a custom `promiseAll` function in TypeScript that behaves like `Promise.all`. Signature: `function promiseAll<T>(promises: Promise<T>[]): Promise<T[]>`. It should reject immediately if any promise rejects, and resolve with all results in order when all succeed.',
        expectedPatterns: [
            'function\\s+promiseAll',
            'Promise',
            'resolve',
            'reject',
            'length|count',
        ],
        maxTokens: 600,
        timeoutMs: 20000,
    },
    {
        id: 'codegen-event-emitter',
        category: 'codegen',
        difficulty: 'hard',
        prompt: 'Write a type-safe EventEmitter class in TypeScript. It should support `on(event, listener)`, `off(event, listener)`, `emit(event, ...args)`, and `once(event, listener)`. Use generics so that event names and payload types are checked at compile time.',
        expectedPatterns: [
            'class\\s+EventEmitter',
            'on\\s*[(<]',
            'off\\s*[(<]',
            'emit\\s*[(<]',
            'once\\s*[(<]',
            '(Map|Record|listeners|handlers)',
        ],
        maxTokens: 1000,
        timeoutMs: 30000,
    },
    // ── Bug Fixing (4 tasks) ──
    {
        id: 'bugfix-off-by-one',
        category: 'bugfix',
        difficulty: 'easy',
        prompt: `Find and fix the bug in this function:

\`\`\`typescript
function binarySearch(arr: number[], target: number): number {
  let left = 0
  let right = arr.length
  while (left < right) {
    const mid = Math.floor((left + right) / 2)
    if (arr[mid] === target) return mid
    if (arr[mid] < target) left = mid
    else right = mid
  }
  return -1
}
\`\`\`

The function enters an infinite loop for some inputs. Explain the bug and provide the corrected version.`,
        expectedPatterns: [
            '(left\\s*=\\s*mid\\s*\\+\\s*1|left\\s*\\+\\s*1|mid\\s*\\+\\s*1)',
            '(infinite|loop|off.by.one|never.advance|stuck)',
            'function\\s+binarySearch',
        ],
        maxTokens: 800,
        timeoutMs: 20000,
    },
    {
        id: 'bugfix-closure-loop',
        category: 'bugfix',
        difficulty: 'medium',
        prompt: `Find and fix the bug in this code:

\`\`\`javascript
function createCounters(n) {
  const counters = []
  for (var i = 0; i < n; i++) {
    counters.push(function() { return i })
  }
  return counters
}
// createCounters(3) returns [f, f, f] — all return 3 instead of 0, 1, 2
\`\`\`

Explain the closure/scoping bug and provide the fix.`,
        expectedPatterns: [
            '(let|const|IIFE|closure|scope|block.scop)',
            '(var\\s+i|shared|captured|reference)',
            '(let\\s+i|\\(function|=>)',
        ],
        maxTokens: 800,
        timeoutMs: 20000,
    },
    {
        id: 'bugfix-async-race',
        category: 'bugfix',
        difficulty: 'hard',
        prompt: `Find and fix the race condition in this React hook:

\`\`\`typescript
function useSearch(query: string) {
  const [results, setResults] = useState([])

  useEffect(() => {
    async function search() {
      const data = await fetchResults(query)
      setResults(data)
    }
    search()
  }, [query])

  return results
}
\`\`\`

If the user types quickly, stale results from earlier requests can overwrite newer ones. Explain the problem and provide the fix with cleanup.`,
        expectedPatterns: [
            '(race.condition|stale|out.of.order|cancelled|abort|cleanup)',
            '(AbortController|cancelled|ignore|flag|stale)',
            'return\\s*(\\(\\)|function|\\(\\)\\s*=>|\\{)',
        ],
        maxTokens: 1000,
        timeoutMs: 25000,
    },
    {
        id: 'bugfix-memory-leak',
        category: 'bugfix',
        difficulty: 'medium',
        prompt: `Find and fix the memory leak in this Node.js code:

\`\`\`typescript
const cache = new Map<string, Buffer>()

app.get('/image/:id', async (req, res) => {
  const id = req.params.id
  if (!cache.has(id)) {
    const buffer = await fs.readFile(\`/images/\${id}.png\`)
    cache.set(id, buffer)
  }
  res.send(cache.get(id))
})
\`\`\`

The server eventually runs out of memory. Explain why and provide a fix.`,
        expectedPatterns: [
            '(memory.leak|unbounded|grows.forever|no.eviction|no.limit)',
            '(LRU|max.size|TTL|expir|evict|limit|WeakRef|delete)',
            '(cache\\.size|Map\\.size|bound|cap)',
        ],
        maxTokens: 800,
        timeoutMs: 20000,
    },
    // ── Refactoring (3 tasks) ──
    {
        id: 'refactor-extract-function',
        category: 'refactor',
        difficulty: 'easy',
        prompt: `Refactor this code by extracting repeated logic into helper functions:

\`\`\`typescript
function processOrders(orders: Order[]) {
  const results = []
  for (const order of orders) {
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tax = subtotal * 0.08
    const shipping = subtotal > 100 ? 0 : 9.99
    const total = subtotal + tax + shipping
    results.push({ orderId: order.id, subtotal, tax, shipping, total })
  }

  const totals = results.map(r => r.total)
  const average = totals.reduce((sum, t) => sum + t, 0) / totals.length
  const max = Math.max(...totals)
  const min = Math.min(...totals)

  return { results, stats: { average, max, min } }
}
\`\`\`

Extract at least two helper functions. Show the refactored code.`,
        expectedPatterns: [
            'function\\s+calc(ulate)?(Subtotal|Total|Tax|Shipping|Order)',
            'function\\s+(calc|compute|get)',
            '(reduce|map)',
        ],
        maxTokens: 1000,
        timeoutMs: 20000,
    },
    {
        id: 'refactor-strategy-pattern',
        category: 'refactor',
        difficulty: 'hard',
        prompt: `Refactor this switch-based code to use the strategy pattern:

\`\`\`typescript
function formatOutput(data: any, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'csv':
      const headers = Object.keys(data[0]).join(',')
      const rows = data.map((row: any) => Object.values(row).join(','))
      return [headers, ...rows].join('\\n')
    case 'xml':
      return data.map((item: any) =>
        '<item>' + Object.entries(item).map(([k, v]) => \`<\${k}>\${v}</\${k}>\`).join('') + '</item>'
      ).join('\\n')
    case 'yaml':
      return data.map((item: any) =>
        Object.entries(item).map(([k, v]) => \`\${k}: \${v}\`).join('\\n')
      ).join('\\n---\\n')
    default:
      throw new Error(\`Unknown format: \${format}\`)
  }
}
\`\`\`

Replace the switch statement with a strategy map/object. Show the refactored code.`,
        expectedPatterns: [
            '(Record|Map|strategies|formatters|handlers)',
            '(interface|type)\\s+(Formatter|Strategy|Format)',
            '(\\[format\\]|get\\(format\\))',
        ],
        maxTokens: 1200,
        timeoutMs: 25000,
    },
    {
        id: 'refactor-promise-chain',
        category: 'refactor',
        difficulty: 'medium',
        prompt: `Refactor this nested promise chain into clean async/await:

\`\`\`typescript
function fetchUserData(userId: string) {
  return fetch(\`/api/users/\${userId}\`)
    .then(res => res.json())
    .then(user => {
      return fetch(\`/api/teams/\${user.teamId}\`)
        .then(res => res.json())
        .then(team => {
          return fetch(\`/api/orgs/\${team.orgId}\`)
            .then(res => res.json())
            .then(org => {
              return { user, team, org }
            })
        })
    })
    .catch(err => {
      console.error('Failed:', err)
      throw err
    })
}
\`\`\`

Convert to async/await. Add proper error handling with try/catch. Show the refactored code.`,
        expectedPatterns: [
            'async\\s+function',
            'await\\s+fetch',
            'try\\s*\\{',
            'catch\\s*\\(',
        ],
        maxTokens: 800,
        timeoutMs: 20000,
    },
    // ── Explanation (3 tasks) ──
    {
        id: 'explain-event-loop',
        category: 'explain',
        difficulty: 'medium',
        prompt: `Explain what this code outputs and why:

\`\`\`javascript
console.log('1')

setTimeout(() => console.log('2'), 0)

Promise.resolve().then(() => console.log('3'))

queueMicrotask(() => console.log('4'))

console.log('5')
\`\`\`

Explain the order of execution in terms of the JavaScript event loop, call stack, microtask queue, and macrotask queue.`,
        expectedPatterns: [
            '1.*5.*3.*4.*2|1,\\s*5,\\s*3,\\s*4,\\s*2',
            '(microtask|micro.task)',
            '(macrotask|macro.task|task.queue|callback.queue|timer)',
            '(event.loop|call.stack)',
        ],
        maxTokens: 1000,
        timeoutMs: 20000,
    },
    {
        id: 'explain-typescript-infer',
        category: 'explain',
        difficulty: 'hard',
        prompt: `Explain what this TypeScript type does, step by step:

\`\`\`typescript
type DeepReadonly<T> = T extends (infer U)[]
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T
\`\`\`

Walk through each conditional branch and explain how it recursively makes a type deeply immutable.`,
        expectedPatterns: [
            '(recursive|recursion|recursively)',
            '(array|infer\\s+U)',
            '(object|keyof)',
            '(readonly|immutable|read.only)',
            '(conditional.type|extends)',
        ],
        maxTokens: 1000,
        timeoutMs: 25000,
    },
    {
        id: 'explain-git-rebase',
        category: 'explain',
        difficulty: 'easy',
        prompt: 'Explain the difference between `git merge` and `git rebase`. When should you use each? What are the risks of rebasing a shared branch? Give concrete examples.',
        expectedPatterns: [
            '(merge|commit.history|merge.commit)',
            '(rebase|replay|re.apply|linear)',
            '(shared.branch|public|force.push|rewrite.history)',
            '(fast.forward|conflict)',
        ],
        maxTokens: 800,
        timeoutMs: 15000,
    },
    // ── Research (3 tasks) ──
    {
        id: 'research-transformer-architecture',
        category: 'research',
        difficulty: 'hard',
        prompt: 'Explain the Transformer architecture from "Attention Is All You Need" (Vaswani et al., 2017). Cover: self-attention mechanism, multi-head attention, positional encoding, encoder-decoder structure, and why it replaced RNNs for sequence tasks. Be technically precise.',
        expectedPatterns: [
            '(self.attention|scaled.dot.product)',
            '(multi.head|multiple.heads)',
            '(positional.encoding|position)',
            '(encoder|decoder)',
            '(softmax|Q.*K.*V|query.*key.*value)',
        ],
        expectedTools: ['web_search'],
        maxTokens: 2000,
        timeoutMs: 45000,
    },
    {
        id: 'research-rust-ownership',
        category: 'research',
        difficulty: 'medium',
        prompt: 'Explain Rust\'s ownership model. Cover: ownership rules, borrowing (shared vs mutable references), lifetimes, and how the borrow checker prevents data races at compile time. Give code examples for each concept.',
        expectedPatterns: [
            '(ownership|owner)',
            '(borrow|&|reference)',
            '(lifetime|\'a)',
            '(borrow.checker|compile.time|data.race)',
            '(mut|mutable)',
        ],
        maxTokens: 2000,
        timeoutMs: 30000,
    },
    {
        id: 'research-crdts',
        category: 'research',
        difficulty: 'hard',
        prompt: 'What are CRDTs (Conflict-free Replicated Data Types)? Explain the difference between state-based (CvRDT) and operation-based (CmRDT) approaches. Give examples of common CRDT types (G-Counter, PN-Counter, LWW-Register, OR-Set) and their merge semantics. Where are CRDTs used in production systems?',
        expectedPatterns: [
            '(CRDT|conflict.free)',
            '(state.based|CvRDT|convergent)',
            '(operation.based|CmRDT|commutative)',
            '(G.Counter|PN.Counter|LWW|OR.Set)',
            '(merge|join|lattice|semilattice)',
        ],
        expectedTools: ['web_search'],
        maxTokens: 2000,
        timeoutMs: 45000,
    },
    // ── Science (2 tasks) ──
    {
        id: 'science-big-o',
        category: 'science',
        difficulty: 'medium',
        prompt: 'Analyze the time complexity of this algorithm and prove your answer:\n\n```typescript\nfunction mystery(arr: number[]): number {\n  const n = arr.length\n  let count = 0\n  for (let i = 0; i < n; i++) {\n    for (let j = i; j < n; j++) {\n      for (let k = i; k <= j; k++) {\n        count++\n      }\n    }\n  }\n  return count\n}\n```\n\nWhat is the time complexity in Big-O notation? Show your derivation.',
        expectedPatterns: [
            'O\\(n[\\^³3]\\)|O\\(n\\s*\\*\\s*n\\s*\\*\\s*n\\)|cubic',
            '(triple|three|3).*(loop|nested)',
            '(sum|summation|\\bΣ\\b|sigma)',
        ],
        maxTokens: 1000,
        timeoutMs: 25000,
    },
    {
        id: 'science-entropy',
        category: 'science',
        difficulty: 'hard',
        prompt: 'Calculate the Shannon entropy of a fair 6-sided die. Then calculate the entropy of a loaded die where P(1)=0.5, P(2)=P(3)=P(4)=P(5)=P(6)=0.1. Show your work, explain the formula H = -Σ p(x) log2 p(x), and explain why the loaded die has lower entropy than the fair die.',
        expectedPatterns: [
            '(Shannon|entropy|information)',
            'H\\s*=|log2|log_2|\\blog\\b',
            '2\\.58|2\\.585',
            '(fair|uniform|maximum)',
            '(lower|less|decrease|uncertainty)',
        ],
        maxTokens: 1200,
        timeoutMs: 25000,
    },
];
// ── Scoring ──
const WEIGHT_PATTERN = 0.5;
const WEIGHT_TOOLS = 0.3;
const WEIGHT_SPEED = 0.2;
/** Score pattern matches (0-1) */
function scorePatterns(response, patterns) {
    if (patterns.length === 0)
        return { score: 1, matched: [], missed: [] };
    const matched = [];
    const missed = [];
    for (const pattern of patterns) {
        try {
            const regex = new RegExp(pattern, 'is');
            if (regex.test(response)) {
                matched.push(pattern);
            }
            else {
                missed.push(pattern);
            }
        }
        catch {
            // Invalid regex — count as missed
            missed.push(pattern);
        }
    }
    return {
        score: matched.length / patterns.length,
        matched,
        missed,
    };
}
/** Score tool usage (0-1) */
function scoreTools(toolsCalled, expectedTools) {
    if (!expectedTools || expectedTools.length === 0)
        return 1; // No tool requirement
    if (toolsCalled.length === 0 && expectedTools.length > 0)
        return 0;
    let matchCount = 0;
    for (const expected of expectedTools) {
        if (toolsCalled.some(t => t.toLowerCase().includes(expected.toLowerCase()))) {
            matchCount++;
        }
    }
    return matchCount / expectedTools.length;
}
/** Score speed (0-1) based on time vs budget */
function scoreSpeed(durationMs, timeoutMs) {
    if (durationMs <= 0)
        return 1;
    if (durationMs >= timeoutMs)
        return 0;
    // Linear interpolation: 0ms=1.0, timeoutMs=0.0
    // But we give a generous curve — completing within 50% of budget is still 1.0
    const ratio = durationMs / timeoutMs;
    if (ratio <= 0.5)
        return 1.0;
    // From 50% to 100%, linearly degrade from 1.0 to 0.0
    return Math.max(0, 1.0 - (ratio - 0.5) * 2);
}
/** Compute overall task score */
function computeTaskScore(patternScore, toolScore, speedScore) {
    return patternScore * WEIGHT_PATTERN + toolScore * WEIGHT_TOOLS + speedScore * WEIGHT_SPEED;
}
/** Run the benchmark suite */
export async function runBenchmark(opts = {}) {
    ensureBenchDir();
    // Filter tasks
    let tasks = [...BENCH_TASKS];
    if (opts.categories && opts.categories.length > 0) {
        const cats = new Set(opts.categories.map(c => c.toLowerCase()));
        tasks = tasks.filter(t => cats.has(t.category));
    }
    if (opts.difficulty) {
        const diff = opts.difficulty.toLowerCase();
        tasks = tasks.filter(t => t.difficulty === diff);
    }
    if (opts.limit && opts.limit > 0) {
        tasks = tasks.slice(0, opts.limit);
    }
    if (tasks.length === 0) {
        throw new Error('No benchmark tasks match the given filters.');
    }
    // Resolve provider/model
    const provider = opts.provider ?? getByokProvider() ?? 'anthropic';
    const model = opts.model ?? getProviderModel(provider, 'default') ?? 'unknown';
    const startTime = Date.now();
    const results = [];
    let totalInput = 0;
    let totalOutput = 0;
    // Print header
    console.error();
    console.error(chalk.bold('  kbot bench') + chalk.dim(` — v${VERSION}`));
    console.error(chalk.dim(`  Provider: ${provider} | Model: ${model}`));
    console.error(chalk.dim(`  Running ${tasks.length} task${tasks.length !== 1 ? 's' : ''}...`));
    console.error(chalk.dim('  ' + '─'.repeat(50)));
    console.error();
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskLabel = `[${i + 1}/${tasks.length}]`;
        const timeout = task.timeoutMs ?? 30000;
        if (opts.verbose) {
            console.error(chalk.dim(`  ${taskLabel} ${task.id} (${task.category}/${task.difficulty})`));
        }
        else {
            process.stderr.write(chalk.dim(`  ${taskLabel} ${task.id}...`));
        }
        const taskStart = Date.now();
        let response = null;
        let error;
        try {
            // Run agent with timeout
            const agentOpts = {
                model: opts.model,
                stream: false,
                skipPlanner: true, // Direct agent call — skip planner for benchmarking
            };
            response = await Promise.race([
                runAgent(task.prompt, agentOpts),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Benchmark task timed out')), timeout)),
            ]);
        }
        catch (err) {
            error = err instanceof Error ? err.message : String(err);
        }
        const durationMs = Date.now() - taskStart;
        const responseText = response?.content ?? '';
        const toolsCalled = extractToolNames(response);
        // Score
        const patternResult = scorePatterns(responseText, task.expectedPatterns);
        const toolScore = scoreTools(toolsCalled, task.expectedTools);
        const speedScore = scoreSpeed(durationMs, timeout);
        const overallScore = computeTaskScore(patternResult.score, toolScore, speedScore);
        // Track token usage
        if (response?.usage) {
            totalInput += response.usage.input_tokens;
            totalOutput += response.usage.output_tokens;
        }
        const taskResult = {
            taskId: task.id,
            category: task.category,
            difficulty: task.difficulty,
            passed: overallScore >= 0.5,
            patternScore: round(patternResult.score),
            toolScore: round(toolScore),
            speedScore: round(speedScore),
            overallScore: round(overallScore),
            durationMs,
            responseLength: responseText.length,
            matchedPatterns: patternResult.matched,
            missedPatterns: patternResult.missed,
            toolsCalled,
            error,
        };
        results.push(taskResult);
        // Print inline result
        if (!opts.verbose) {
            const icon = taskResult.passed ? chalk.green(' ✓') : chalk.red(' ✗');
            const scoreStr = chalk.dim(` ${Math.round(overallScore * 100)}%`);
            const timeStr = chalk.dim(` ${(durationMs / 1000).toFixed(1)}s`);
            process.stderr.write(`${icon}${scoreStr}${timeStr}\n`);
        }
        else {
            printVerboseResult(taskResult);
        }
    }
    const totalDuration = Date.now() - startTime;
    // Compute aggregate scores
    const totalScore = results.length > 0
        ? round(results.reduce((s, r) => s + r.overallScore, 0) / results.length * 100)
        : 0;
    const categoryScores = {};
    const categoryGroups = groupBy(results, r => r.category);
    for (const [cat, catResults] of Object.entries(categoryGroups)) {
        categoryScores[cat] = round(catResults.reduce((s, r) => s + r.overallScore, 0) / catResults.length * 100);
    }
    const benchResult = {
        timestamp: new Date().toISOString(),
        provider,
        model,
        kbotVersion: VERSION,
        totalScore,
        categoryScores,
        tasks: results,
        duration: totalDuration,
        tokenUsage: { input: totalInput, output: totalOutput },
    };
    // Save
    saveBenchResult(benchResult);
    // Print summary
    formatBenchResult(benchResult);
    return benchResult;
}
// ── Tool name extraction ──
/** Extract tool names from an agent response (best effort from response text) */
function extractToolNames(response) {
    if (!response)
        return [];
    // The agent response tracks toolCalls count but not individual names.
    // We parse the response text for tool call patterns used by kbot's UI output.
    const tools = [];
    const text = response.content ?? '';
    // Pattern: kbot prints tool calls as "▸ tool_name" or "→ tool_name"
    const toolCallPattern = /(?:▸|→|Tool:\s*)(\w+)/g;
    let match;
    while ((match = toolCallPattern.exec(text)) !== null) {
        if (!tools.includes(match[1])) {
            tools.push(match[1]);
        }
    }
    // Also detect common tool usage from content
    if (/```[\s\S]*?```/.test(text))
        tools.push('code_generation');
    if (/https?:\/\//.test(text) && /search|found|results/i.test(text))
        tools.push('web_search');
    return tools;
}
// ── History & Comparison ──
/** Save a benchmark result to disk */
function saveBenchResult(result) {
    ensureBenchDir();
    const filename = `bench-${result.timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = join(BENCH_DIR, filename);
    writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
}
/** Get all saved benchmark results, sorted newest first */
export function getBenchHistory() {
    ensureBenchDir();
    const files = readdirSync(BENCH_DIR)
        .filter(f => f.startsWith('bench-') && f.endsWith('.json'))
        .sort()
        .reverse();
    const results = [];
    for (const file of files) {
        try {
            const data = readFileSync(join(BENCH_DIR, file), 'utf-8');
            results.push(JSON.parse(data));
        }
        catch {
            // Skip corrupted files
        }
    }
    return results;
}
/** Compare two benchmark results and format a comparison table */
export function compareBenchmarks(a, b) {
    const lines = [];
    const SEP = chalk.dim('─'.repeat(62));
    lines.push('');
    lines.push(chalk.bold('  Benchmark Comparison'));
    lines.push(SEP);
    lines.push('');
    // Header row
    const labelA = `${a.provider}/${a.model} (${formatTimestamp(a.timestamp)})`;
    const labelB = `${b.provider}/${b.model} (${formatTimestamp(b.timestamp)})`;
    lines.push(`  ${chalk.dim('Metric'.padEnd(20))} ${chalk.cyan(labelA.padEnd(20))} ${chalk.hex('#FB923C')(labelB.padEnd(20))}`);
    lines.push(SEP);
    // Overall score
    lines.push(formatComparisonRow('Overall Score', a.totalScore, b.totalScore, '%'));
    // Category scores
    const allCats = new Set([...Object.keys(a.categoryScores), ...Object.keys(b.categoryScores)]);
    for (const cat of allCats) {
        const scoreA = a.categoryScores[cat] ?? 0;
        const scoreB = b.categoryScores[cat] ?? 0;
        lines.push(formatComparisonRow(`  ${cat}`, scoreA, scoreB, '%'));
    }
    lines.push(SEP);
    // Duration
    lines.push(formatComparisonRow('Duration', round(a.duration / 1000), round(b.duration / 1000), 's', true));
    // Token usage
    lines.push(formatComparisonRow('Input Tokens', a.tokenUsage.input, b.tokenUsage.input, '', true));
    lines.push(formatComparisonRow('Output Tokens', a.tokenUsage.output, b.tokenUsage.output, '', true));
    // Task-by-task comparison
    lines.push('');
    lines.push(chalk.bold('  Task Breakdown'));
    lines.push(SEP);
    lines.push(`  ${chalk.dim('Task'.padEnd(28))} ${chalk.dim('A'.padStart(6))} ${chalk.dim('B'.padStart(6))} ${chalk.dim('Δ'.padStart(8))}`);
    lines.push(SEP);
    const taskMapA = new Map(a.tasks.map(t => [t.taskId, t]));
    const taskMapB = new Map(b.tasks.map(t => [t.taskId, t]));
    const allTaskIds = new Set([...taskMapA.keys(), ...taskMapB.keys()]);
    for (const id of allTaskIds) {
        const ta = taskMapA.get(id);
        const tb = taskMapB.get(id);
        const scoreA = ta ? Math.round(ta.overallScore * 100) : 0;
        const scoreB = tb ? Math.round(tb.overallScore * 100) : 0;
        const delta = scoreB - scoreA;
        const deltaColor = delta > 0 ? chalk.green : delta < 0 ? chalk.red : chalk.dim;
        const deltaStr = delta > 0 ? `+${delta}%` : `${delta}%`;
        lines.push(`  ${id.padEnd(28)} ${String(scoreA + '%').padStart(6)} ${String(scoreB + '%').padStart(6)} ${deltaColor(deltaStr.padStart(8))}`);
    }
    lines.push(SEP);
    lines.push('');
    return lines.join('\n');
}
// ── Display ──
/** Format and print a benchmark result as a terminal table */
export function formatBenchResult(result) {
    const SEP = chalk.dim('  ' + '─'.repeat(58));
    console.error();
    console.error(chalk.bold('  Benchmark Results'));
    console.error(SEP);
    console.error();
    // Summary row
    const scoreColor = result.totalScore >= 80 ? chalk.green
        : result.totalScore >= 60 ? chalk.yellow
            : chalk.red;
    console.error(`  ${chalk.bold('Overall Score:')}  ${scoreColor(result.totalScore + '%')}`);
    console.error(`  ${chalk.dim('Provider:')}       ${result.provider}`);
    console.error(`  ${chalk.dim('Model:')}          ${result.model}`);
    console.error(`  ${chalk.dim('kbot Version:')}   ${result.kbotVersion}`);
    console.error(`  ${chalk.dim('Duration:')}       ${(result.duration / 1000).toFixed(1)}s`);
    console.error(`  ${chalk.dim('Tokens:')}         ${result.tokenUsage.input.toLocaleString()} in / ${result.tokenUsage.output.toLocaleString()} out`);
    console.error();
    // Category scores
    console.error(chalk.bold('  Category Scores'));
    console.error(SEP);
    const catOrder = ['codegen', 'bugfix', 'refactor', 'explain', 'research', 'science'];
    for (const cat of catOrder) {
        const score = result.categoryScores[cat];
        if (score === undefined)
            continue;
        const bar = renderBar(score);
        const scoreStr = String(score + '%').padStart(4);
        console.error(`  ${cat.padEnd(12)} ${bar} ${scoreStr}`);
    }
    console.error();
    // Task details
    console.error(chalk.bold('  Task Results'));
    console.error(SEP);
    console.error(`  ${chalk.dim('Task'.padEnd(28))} ${chalk.dim('Score'.padStart(6))} ${chalk.dim('Pat'.padStart(5))} ${chalk.dim('Tool'.padStart(5))} ${chalk.dim('Spd'.padStart(5))} ${chalk.dim('Time'.padStart(7))}`);
    console.error(SEP);
    for (const task of result.tasks) {
        const icon = task.passed ? chalk.green('✓') : chalk.red('✗');
        const score = Math.round(task.overallScore * 100);
        const scoreColor = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
        const patStr = Math.round(task.patternScore * 100) + '%';
        const toolStr = Math.round(task.toolScore * 100) + '%';
        const spdStr = Math.round(task.speedScore * 100) + '%';
        const timeStr = (task.durationMs / 1000).toFixed(1) + 's';
        console.error(`  ${icon} ${task.taskId.padEnd(26)} ${scoreColor(String(score + '%').padStart(5))} ${chalk.dim(patStr.padStart(5))} ${chalk.dim(toolStr.padStart(5))} ${chalk.dim(spdStr.padStart(5))} ${chalk.dim(timeStr.padStart(7))}`);
        if (task.error) {
            console.error(chalk.red(`    Error: ${task.error}`));
        }
    }
    console.error(SEP);
    // Passed/failed summary
    const passed = result.tasks.filter(t => t.passed).length;
    const failed = result.tasks.length - passed;
    console.error();
    console.error(`  ${chalk.green(passed + ' passed')}  ${failed > 0 ? chalk.red(failed + ' failed') : chalk.dim('0 failed')}`);
    console.error();
}
/** Format benchmark history as a compact table */
export function formatBenchHistory(results) {
    if (results.length === 0)
        return chalk.dim('  No benchmark history found.');
    const lines = [];
    const SEP = chalk.dim('  ' + '─'.repeat(62));
    lines.push('');
    lines.push(chalk.bold('  Benchmark History'));
    lines.push(SEP);
    lines.push(`  ${chalk.dim('#'.padStart(3))} ${chalk.dim('Date'.padEnd(12))} ${chalk.dim('Provider'.padEnd(12))} ${chalk.dim('Model'.padEnd(16))} ${chalk.dim('Score'.padStart(6))} ${chalk.dim('Tasks'.padStart(6))}`);
    lines.push(SEP);
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const idx = String(i + 1).padStart(3);
        const date = formatTimestamp(r.timestamp);
        const score = r.totalScore;
        const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
        const taskCount = r.tasks.length;
        lines.push(`  ${chalk.dim(idx)} ${date.padEnd(12)} ${r.provider.padEnd(12)} ${r.model.padEnd(16)} ${scoreColor(String(score + '%').padStart(5))} ${chalk.dim(String(taskCount).padStart(6))}`);
    }
    lines.push(SEP);
    lines.push('');
    return lines.join('\n');
}
// ── Verbose Output ──
function printVerboseResult(task) {
    const icon = task.passed ? chalk.green('  ✓') : chalk.red('  ✗');
    const score = Math.round(task.overallScore * 100);
    const scoreColor = score >= 80 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
    console.error(`${icon} ${chalk.bold(task.taskId)} ${scoreColor(score + '%')} ${chalk.dim(`(${(task.durationMs / 1000).toFixed(1)}s)`)}`);
    console.error(chalk.dim(`    Pattern: ${Math.round(task.patternScore * 100)}% | Tool: ${Math.round(task.toolScore * 100)}% | Speed: ${Math.round(task.speedScore * 100)}%`));
    if (task.matchedPatterns.length > 0) {
        console.error(chalk.green(`    Matched: ${task.matchedPatterns.length}/${task.matchedPatterns.length + task.missedPatterns.length} patterns`));
    }
    if (task.missedPatterns.length > 0) {
        console.error(chalk.red(`    Missed:  ${task.missedPatterns.map(p => `/${p}/`).join(', ')}`));
    }
    if (task.toolsCalled.length > 0) {
        console.error(chalk.dim(`    Tools:   ${task.toolsCalled.join(', ')}`));
    }
    if (task.error) {
        console.error(chalk.red(`    Error:   ${task.error}`));
    }
    console.error();
}
// ── Helpers ──
/** Render a colored bar chart segment (20 chars wide) */
function renderBar(percentage) {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const color = percentage >= 80 ? chalk.green : percentage >= 60 ? chalk.yellow : chalk.red;
    return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}
/** Format an ISO timestamp to a short date string */
function formatTimestamp(iso) {
    try {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    catch {
        return iso.slice(0, 10);
    }
}
/** Format a comparison row with delta coloring */
function formatComparisonRow(label, valueA, valueB, unit, lowerIsBetter = false) {
    const delta = valueB - valueA;
    const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
    const deltaColor = delta === 0 ? chalk.dim
        : isImprovement ? chalk.green
            : chalk.red;
    const deltaSign = delta > 0 ? '+' : '';
    const deltaStr = deltaColor(`${deltaSign}${round(delta)}${unit}`);
    return `  ${label.padEnd(20)} ${String(valueA + unit).padStart(10)} ${String(valueB + unit).padStart(10)} ${deltaStr.padStart(10)}`;
}
/** Round to 2 decimal places */
function round(n) {
    return Math.round(n * 100) / 100;
}
/** Group an array by a key function */
function groupBy(items, keyFn) {
    const groups = {};
    for (const item of items) {
        const key = keyFn(item);
        if (!groups[key])
            groups[key] = [];
        groups[key].push(item);
    }
    return groups;
}
// ── CLI entry point ──
/** Register the bench subcommand with Commander */
export function registerBenchCommand(program) {
    program
        .command('bench')
        .description('Run benchmarks — score kbot against standardized tasks')
        .option('-c, --category <categories...>', 'Filter by category (codegen, bugfix, refactor, explain, research, science)')
        .option('-d, --difficulty <level>', 'Filter by difficulty (easy, medium, hard)')
        .option('-p, --provider <provider>', 'Override provider')
        .option('-m, --model <model>', 'Override model')
        .option('-l, --limit <n>', 'Max tasks to run', parseInt)
        .option('-v, --verbose', 'Show detailed per-task output')
        .option('--compare', 'Compare last two benchmark runs')
        .option('--history', 'Show all past benchmark runs')
        .action(async (opts) => {
        // History mode
        if (opts.history) {
            const history = getBenchHistory();
            console.error(formatBenchHistory(history));
            return;
        }
        // Compare mode
        if (opts.compare) {
            const history = getBenchHistory();
            if (history.length < 2) {
                console.error(chalk.red('  Need at least 2 benchmark runs to compare. Run `kbot bench` first.'));
                process.exit(1);
            }
            console.error(compareBenchmarks(history[1], history[0])); // older first, newer second
            return;
        }
        // Run benchmarks
        try {
            await runBenchmark({
                categories: opts.category,
                difficulty: opts.difficulty,
                provider: opts.provider,
                model: opts.model,
                limit: opts.limit,
                verbose: opts.verbose,
            });
        }
        catch (err) {
            console.error(chalk.red(`  Benchmark failed: ${err instanceof Error ? err.message : err}`));
            process.exit(1);
        }
    });
}
//# sourceMappingURL=bench.js.map