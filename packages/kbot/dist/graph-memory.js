// kbot Graph Memory — Knowledge graph for entity-relationship reasoning
//
// Extends flat memory (memory.ts, memory-tools.ts) with a graph structure:
// entities connected by typed relationships so the agent can reason about
// connections between concepts, files, people, bugs, decisions, and patterns.
//
// Stored at ~/.kbot/graph.json as a single file.
// No external dependencies — fuzzy search uses simple heuristics.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { registerTool } from './tools/index.js';
// ── Constants ──
const KBOT_DIR = join(homedir(), '.kbot');
const GRAPH_FILE = join(KBOT_DIR, 'graph.json');
const MAX_NODES = 1000;
const MAX_EDGES = 5000;
const ID_LENGTH = 8;
// ── Module state ──
let graph = {
    nodes: new Map(),
    edges: [],
};
// ── ID generation ──
function generateId() {
    return randomBytes(ID_LENGTH / 2).toString('hex');
}
// ── Persistence ──
function ensureDir() {
    if (!existsSync(KBOT_DIR)) {
        mkdirSync(KBOT_DIR, { recursive: true });
    }
}
/** Load graph from ~/.kbot/graph.json */
export function load() {
    ensureDir();
    if (!existsSync(GRAPH_FILE)) {
        graph = { nodes: new Map(), edges: [] };
        return;
    }
    try {
        const raw = JSON.parse(readFileSync(GRAPH_FILE, 'utf-8'));
        graph = {
            nodes: new Map(raw.nodes || []),
            edges: raw.edges || [],
        };
    }
    catch {
        graph = { nodes: new Map(), edges: [] };
    }
}
/** Save graph to ~/.kbot/graph.json */
export function save() {
    ensureDir();
    const data = {
        nodes: Array.from(graph.nodes.entries()),
        edges: graph.edges,
    };
    writeFileSync(GRAPH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
// ── Fuzzy search ──
/**
 * Compute a similarity score between two strings (0-1).
 * Combines substring match and character-level edit distance.
 * No external dependencies.
 */
function fuzzyScore(query, target) {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    // Exact match
    if (q === t)
        return 1.0;
    // Substring containment — strong signal
    if (t.includes(q)) {
        return 0.7 + 0.3 * (q.length / t.length);
    }
    if (q.includes(t)) {
        return 0.6 + 0.2 * (t.length / q.length);
    }
    // Simple Levenshtein-like distance ratio
    const distance = levenshtein(q, t);
    const maxLen = Math.max(q.length, t.length);
    if (maxLen === 0)
        return 1.0;
    const ratio = 1 - distance / maxLen;
    return Math.max(0, ratio);
}
/** Levenshtein edit distance — standard DP implementation */
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    // Optimization: use single-row DP
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++)
        prev[j] = j;
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, // deletion
            curr[j - 1] + 1, // insertion
            prev[j - 1] + cost // substitution
            );
        }
        ;
        [prev, curr] = [curr, prev];
    }
    return prev[n];
}
// ── Core API ──
/** Add a node to the graph. Returns the new node. */
export function addNode(type, name, properties = {}) {
    // Check for existing node with same type and name to avoid duplicates
    for (const existing of Array.from(graph.nodes.values())) {
        if (existing.type === type && existing.name.toLowerCase() === name.toLowerCase()) {
            existing.lastAccessed = new Date().toISOString();
            existing.accessCount++;
            // Merge properties
            Object.assign(existing.properties, properties);
            return existing;
        }
    }
    // Enforce max nodes — prune lowest-weight if at capacity
    if (graph.nodes.size >= MAX_NODES) {
        pruneToCapacity();
    }
    const now = new Date().toISOString();
    const node = {
        id: generateId(),
        type,
        name,
        properties,
        created: now,
        lastAccessed: now,
        accessCount: 1,
    };
    graph.nodes.set(node.id, node);
    return node;
}
/** Add an edge between two nodes. Returns true if successful. */
export function addEdge(sourceId, targetId, relation, weight = 0.5) {
    if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) {
        return false;
    }
    // Clamp weight to [0, 1]
    const clampedWeight = Math.max(0, Math.min(1, weight));
    // Check for existing edge with same source, target, and relation
    const existing = graph.edges.find(e => e.source === sourceId && e.target === targetId && e.relation === relation);
    if (existing) {
        // Strengthen existing edge
        existing.weight = Math.min(1, existing.weight + 0.1);
        return true;
    }
    // Enforce max edges — prune lowest-weight if at capacity
    if (graph.edges.length >= MAX_EDGES) {
        graph.edges.sort((a, b) => a.weight - b.weight);
        graph.edges = graph.edges.slice(Math.floor(MAX_EDGES * 0.1)); // Drop bottom 10%
    }
    graph.edges.push({
        source: sourceId,
        target: targetId,
        relation,
        weight: clampedWeight,
        created: new Date().toISOString(),
    });
    return true;
}
/** Fuzzy search nodes by name. Returns matches sorted by relevance. */
export function findNode(query) {
    const threshold = 0.3;
    const scored = [];
    for (const node of Array.from(graph.nodes.values())) {
        // Score against name and property values
        let bestScore = fuzzyScore(query, node.name);
        for (const val of Object.values(node.properties)) {
            const propScore = fuzzyScore(query, val) * 0.8; // Properties slightly less relevant
            bestScore = Math.max(bestScore, propScore);
        }
        if (bestScore >= threshold) {
            scored.push({ node, score: bestScore });
        }
    }
    // Sort by score descending, then by access count as tiebreaker
    scored.sort((a, b) => b.score - a.score || b.node.accessCount - a.node.accessCount);
    // Touch accessed nodes
    const now = new Date().toISOString();
    for (const { node } of scored.slice(0, 20)) {
        node.lastAccessed = now;
        node.accessCount++;
    }
    return scored.slice(0, 20).map(s => s.node);
}
/** Get connected nodes up to a given depth (default 1, max 3). */
export function getNeighbors(nodeId, depth = 1) {
    const clampedDepth = Math.max(1, Math.min(3, depth));
    const visitedIds = new Set([nodeId]);
    const resultEdges = [];
    let frontier = new Set([nodeId]);
    for (let d = 0; d < clampedDepth; d++) {
        const nextFrontier = new Set();
        for (const edge of graph.edges) {
            if (frontier.has(edge.source) && !visitedIds.has(edge.target)) {
                visitedIds.add(edge.target);
                nextFrontier.add(edge.target);
                resultEdges.push(edge);
            }
            if (frontier.has(edge.target) && !visitedIds.has(edge.source)) {
                visitedIds.add(edge.source);
                nextFrontier.add(edge.source);
                resultEdges.push(edge);
            }
        }
        frontier = nextFrontier;
        if (frontier.size === 0)
            break;
    }
    const resultNodes = [];
    for (const id of Array.from(visitedIds)) {
        const node = graph.nodes.get(id);
        if (node)
            resultNodes.push(node);
    }
    return { nodes: resultNodes, edges: resultEdges };
}
/** Get a subgraph containing the given node IDs and all edges between them. */
export function getSubgraph(nodeIds) {
    const idSet = new Set(nodeIds);
    const nodes = [];
    for (const id of Array.from(idSet)) {
        const node = graph.nodes.get(id);
        if (node)
            nodes.push(node);
    }
    const edges = graph.edges.filter(e => idSet.has(e.source) && idSet.has(e.target));
    return { nodes, edges };
}
/** BFS shortest path between two nodes. Returns node IDs in order, or empty array if no path. */
export function shortestPath(fromId, toId) {
    if (!graph.nodes.has(fromId) || !graph.nodes.has(toId))
        return [];
    if (fromId === toId)
        return [fromId];
    // Build adjacency list (undirected)
    const adj = new Map();
    for (const nodeKey of Array.from(graph.nodes.keys())) {
        adj.set(nodeKey, []);
    }
    for (const edge of graph.edges) {
        const srcList = adj.get(edge.source);
        if (srcList && srcList.indexOf(edge.target) === -1)
            srcList.push(edge.target);
        const tgtList = adj.get(edge.target);
        if (tgtList && tgtList.indexOf(edge.source) === -1)
            tgtList.push(edge.source);
    }
    // BFS
    const visited = new Set();
    visited.add(fromId);
    const parent = new Map();
    const queue = [fromId];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === toId) {
            // Reconstruct path
            const path = [toId];
            let step = toId;
            while (parent.has(step)) {
                step = parent.get(step);
                path.unshift(step);
            }
            return path;
        }
        const neighbors = adj.get(current);
        if (!neighbors)
            continue;
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                parent.set(neighbor, current);
                queue.push(neighbor);
            }
        }
    }
    return []; // No path found
}
/** Get all edges of a given relation type. */
export function queryRelation(relation) {
    const lowerRelation = relation.toLowerCase();
    return graph.edges.filter(e => e.relation.toLowerCase() === lowerRelation);
}
/** Reduce weight of nodes unaccessed for more than `days` days. */
export function decayUnused(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffISO = cutoff.toISOString();
    let decayed = 0;
    for (const node of Array.from(graph.nodes.values())) {
        if (node.lastAccessed < cutoffISO) {
            // Decay edges connected to this node
            for (const edge of graph.edges) {
                if (edge.source === node.id || edge.target === node.id) {
                    edge.weight = Math.max(0, edge.weight - 0.1);
                }
            }
            decayed++;
        }
    }
    return { decayed };
}
/** Remove nodes with accessCount below a threshold, and their dangling edges. */
export function prune(minWeight) {
    const edgesBefore = graph.edges.length;
    // Remove low-weight edges
    graph.edges = graph.edges.filter(e => e.weight >= minWeight);
    // Find nodes that have no edges and low access count
    const connectedIds = new Set();
    for (const edge of graph.edges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
    }
    let removedNodes = 0;
    for (const [id, node] of Array.from(graph.nodes.entries())) {
        // Remove disconnected nodes with weight proxy (accessCount as standin) below threshold
        // A node's effective weight: accessCount normalized, capped at 1
        const effectiveWeight = Math.min(1, node.accessCount / 10);
        if (!connectedIds.has(id) && effectiveWeight < minWeight) {
            graph.nodes.delete(id);
            removedNodes++;
        }
    }
    return {
        removedNodes,
        removedEdges: edgesBefore - graph.edges.length,
    };
}
/**
 * Serialize relevant subgraph into a compact, readable format for LLM context injection.
 *
 * Format:
 *   [file:auth.ts] --uses--> [entity:JWT] --implements--> [decision:use RS256]
 *   [person:Isaac] --authored--> [file:agent.ts]
 */
export function toContext(maxTokens = 2000) {
    if (graph.nodes.size === 0)
        return '[No graph memory]';
    // Prioritize recently accessed, high-access-count nodes
    const sortedNodes = Array.from(graph.nodes.values()).sort((a, b) => {
        // Primary: lastAccessed descending
        const timeDiff = b.lastAccessed.localeCompare(a.lastAccessed);
        if (timeDiff !== 0)
            return timeDiff;
        // Secondary: accessCount descending
        return b.accessCount - a.accessCount;
    });
    // Build lines from edges, referencing the most relevant nodes
    const relevantIds = new Set(sortedNodes.slice(0, 100).map(n => n.id));
    const lines = [];
    const usedNodeIds = new Set();
    // Format edges between relevant nodes
    for (const edge of graph.edges) {
        if (!relevantIds.has(edge.source) && !relevantIds.has(edge.target))
            continue;
        const sourceNode = graph.nodes.get(edge.source);
        const targetNode = graph.nodes.get(edge.target);
        if (!sourceNode || !targetNode)
            continue;
        const line = `[${sourceNode.type}:${sourceNode.name}] --${edge.relation}--> [${targetNode.type}:${targetNode.name}]`;
        lines.push(line);
        usedNodeIds.add(edge.source);
        usedNodeIds.add(edge.target);
    }
    // Add isolated relevant nodes not in any edge
    for (const node of sortedNodes.slice(0, 50)) {
        if (!usedNodeIds.has(node.id)) {
            const props = Object.entries(node.properties)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
            const propStr = props ? ` (${props})` : '';
            lines.push(`[${node.type}:${node.name}]${propStr}`);
            usedNodeIds.add(node.id);
        }
    }
    // Truncate to approximate token budget (rough: 4 chars ~ 1 token)
    const charLimit = maxTokens * 4;
    const result = [];
    let charCount = 0;
    for (const line of lines) {
        if (charCount + line.length > charLimit)
            break;
        result.push(line);
        charCount += line.length + 1;
    }
    if (result.length === 0)
        return '[No graph memory]';
    const header = `[Graph Memory — ${graph.nodes.size} nodes, ${graph.edges.length} edges]`;
    return `${header}\n${result.join('\n')}`;
}
// ── Capacity management ──
function pruneToCapacity() {
    // Remove the least-accessed, oldest nodes to get back under MAX_NODES
    const sorted = Array.from(graph.nodes.values()).sort((a, b) => {
        // Sort ascending by access count, then by lastAccessed
        if (a.accessCount !== b.accessCount)
            return a.accessCount - b.accessCount;
        return a.lastAccessed.localeCompare(b.lastAccessed);
    });
    const toRemove = sorted.slice(0, Math.floor(MAX_NODES * 0.1)); // Remove bottom 10%
    for (const node of toRemove) {
        graph.nodes.delete(node.id);
        // Remove orphaned edges
        graph.edges = graph.edges.filter(e => e.source !== node.id && e.target !== node.id);
    }
}
// ── Auto-extraction ──
/** File path pattern: Unix and Windows paths */
const FILE_PATH_RE = /(?:\/[\w./-]+\.[\w]+|[A-Z]:\\[\w.\\-]+\.[\w]+)/g;
/** GitHub issue/PR pattern: org/repo#123 or #123 */
const GITHUB_REF_RE = /(?:[\w-]+\/[\w-]+)?#(\d+)/g;
/** Function/class name pattern: common code identifiers */
const IDENTIFIER_RE = /\b(?:function|class|const|let|var|def|fn)\s+([A-Za-z_]\w{2,})/g;
/** Decision pattern: "let's use X", "we chose X", "decided to X", "going with X" */
const DECISION_RE = /(?:let'?s?\s+use|we\s+chose|decided?\s+(?:to|on)|going\s+with|switched?\s+to)\s+([^\n,.;]+)/gi;
/** Pattern detection: "always do X", "never Y", "when X then Y" */
const PATTERN_RE = /(?:always\s+|never\s+|when\s+\S+.*?\s+then\s+)([^\n,.;]+)/gi;
/**
 * Extract entities from a user message and agent response using simple heuristics.
 * Returns the newly created nodes.
 */
export function extractEntities(userMessage, agentResponse) {
    const combined = `${userMessage}\n${agentResponse}`;
    const newNodes = [];
    // File paths → 'file' nodes
    const filePaths = new Set();
    let match;
    FILE_PATH_RE.lastIndex = 0;
    while ((match = FILE_PATH_RE.exec(combined)) !== null) {
        filePaths.add(match[0]);
    }
    for (const fp of Array.from(filePaths)) {
        const name = fp.split('/').pop() || fp;
        const node = addNode('file', name, { path: fp });
        newNodes.push(node);
    }
    // GitHub issues/PRs → 'bug' nodes
    const ghRefs = new Set();
    GITHUB_REF_RE.lastIndex = 0;
    while ((match = GITHUB_REF_RE.exec(combined)) !== null) {
        ghRefs.add(match[0]);
    }
    for (const ref of Array.from(ghRefs)) {
        const node = addNode('bug', ref, { reference: ref });
        newNodes.push(node);
    }
    // Function/class names → 'entity' nodes
    const identifiers = new Set();
    IDENTIFIER_RE.lastIndex = 0;
    while ((match = IDENTIFIER_RE.exec(combined)) !== null) {
        // Skip very short or very common names
        const name = match[1];
        if (name.length > 2 && !['the', 'get', 'set', 'new', 'var', 'let'].includes(name.toLowerCase())) {
            identifiers.add(name);
        }
    }
    for (const ident of Array.from(identifiers)) {
        const node = addNode('entity', ident, { kind: 'code-identifier' });
        newNodes.push(node);
    }
    // Decisions → 'decision' nodes
    DECISION_RE.lastIndex = 0;
    while ((match = DECISION_RE.exec(combined)) !== null) {
        const decision = match[1].trim();
        if (decision.length > 3 && decision.length < 200) {
            const node = addNode('decision', decision, { source: 'conversation' });
            newNodes.push(node);
        }
    }
    // Patterns → 'pattern' nodes
    PATTERN_RE.lastIndex = 0;
    while ((match = PATTERN_RE.exec(combined)) !== null) {
        const pattern = match[1].trim();
        if (pattern.length > 5 && pattern.length < 200) {
            const node = addNode('pattern', pattern, { source: 'conversation' });
            newNodes.push(node);
        }
    }
    return newNodes;
}
/**
 * Auto-create edges between a node and other nodes that were extracted
 * from the same conversation turn. Nodes sharing a conversation turn
 * are assumed to be related.
 */
export function autoConnect(nodeId) {
    const node = graph.nodes.get(nodeId);
    if (!node)
        return 0;
    // Find nodes created or accessed at the same time (within 2 seconds)
    const nodeTime = new Date(node.lastAccessed).getTime();
    let connected = 0;
    for (const other of Array.from(graph.nodes.values())) {
        if (other.id === nodeId)
            continue;
        const otherTime = new Date(other.lastAccessed).getTime();
        if (Math.abs(nodeTime - otherTime) < 2000) {
            // Determine relation type based on node types
            const relation = inferRelation(node, other);
            if (addEdge(nodeId, other.id, relation, 0.3)) {
                connected++;
            }
        }
    }
    return connected;
}
/** Infer a sensible relation type between two nodes based on their types. */
function inferRelation(a, b) {
    const pair = `${a.type}:${b.type}`;
    switch (pair) {
        case 'person:file': return 'authored';
        case 'file:person': return 'authored_by';
        case 'file:entity': return 'contains';
        case 'entity:file': return 'defined_in';
        case 'file:bug': return 'affected_by';
        case 'bug:file': return 'affects';
        case 'decision:entity': return 'chose';
        case 'entity:decision': return 'chosen_by';
        case 'decision:file': return 'applies_to';
        case 'file:decision': return 'governed_by';
        case 'pattern:entity': return 'applies_to';
        case 'entity:pattern': return 'follows';
        case 'bug:entity': return 'involves';
        case 'entity:bug': return 'involved_in';
        case 'file:file': return 'related_to';
        case 'entity:entity': return 'related_to';
        case 'concept:entity': return 'describes';
        case 'entity:concept': return 'described_by';
        default: return 'related_to';
    }
}
// ── Import from flat memory ──
/**
 * Bootstrap graph from existing flat memory files (from memory-tools.ts).
 * Reads JSON memory files in ~/.kbot/memory/{category}/ and converts them
 * into graph nodes and edges.
 */
export function importFromMemory(memoryDir) {
    const baseDir = memoryDir || join(homedir(), '.kbot', 'memory');
    if (!existsSync(baseDir))
        return { imported: 0, edges: 0 };
    const categories = ['fact', 'preference', 'pattern', 'solution'];
    const importedNodes = [];
    let edgeCount = 0;
    for (const category of categories) {
        const catDir = join(baseDir, category);
        if (!existsSync(catDir))
            continue;
        let files;
        try {
            files = readdirSync(catDir).filter(f => f.endsWith('.json'));
        }
        catch {
            continue;
        }
        for (const file of files) {
            try {
                const raw = JSON.parse(readFileSync(join(catDir, file), 'utf-8'));
                const nodeType = categoryToNodeType(category);
                const node = addNode(nodeType, raw.key || file.replace('.json', ''), {
                    content: typeof raw.content === 'string' ? raw.content.slice(0, 500) : '',
                    category,
                    originalCreated: raw.created_at || '',
                });
                importedNodes.push(node);
            }
            catch {
                // Skip malformed files
            }
        }
    }
    // Also check for context.md — extract any top-level sections as concept nodes
    const contextFile = join(baseDir, 'context.md');
    if (existsSync(contextFile)) {
        try {
            const content = readFileSync(contextFile, 'utf-8');
            const sections = content.split(/^## /m).filter(s => s.trim());
            for (const section of sections.slice(0, 50)) {
                const firstLine = section.split('\n')[0].trim();
                if (firstLine && firstLine.length > 2) {
                    const node = addNode('concept', firstLine, {
                        source: 'context.md',
                        excerpt: section.slice(0, 300),
                    });
                    importedNodes.push(node);
                }
            }
        }
        catch {
            // Skip if context.md is unreadable
        }
    }
    // Auto-connect imported nodes that share content keywords
    for (let i = 0; i < importedNodes.length; i++) {
        for (let j = i + 1; j < importedNodes.length; j++) {
            const a = importedNodes[i];
            const b = importedNodes[j];
            const similarity = fuzzyScore(a.name, b.name);
            if (similarity > 0.5) {
                addEdge(a.id, b.id, 'related_to', similarity * 0.5);
                edgeCount++;
            }
        }
    }
    return { imported: importedNodes.length, edges: edgeCount };
}
function categoryToNodeType(category) {
    switch (category) {
        case 'pattern': return 'pattern';
        case 'solution': return 'entity';
        case 'preference': return 'decision';
        case 'fact':
        default: return 'concept';
    }
}
// ── Graph statistics ──
export function getStats() {
    const nodesByType = {};
    for (const node of Array.from(graph.nodes.values())) {
        nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }
    const topNodes = Array.from(graph.nodes.values())
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10)
        .map(n => ({ name: n.name, type: n.type, accessCount: n.accessCount }));
    return {
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        nodesByType,
        topNodes,
    };
}
/** Get a node by ID (for internal use and testing). */
export function getNode(id) {
    return graph.nodes.get(id);
}
/** Get the raw graph (for testing / advanced usage). */
export function getGraph() {
    return graph;
}
// ── Tool registration ──
export function registerGraphMemoryTools() {
    // ── graph_add ──
    registerTool({
        name: 'graph_add',
        description: 'Add an entity to the knowledge graph with optional edges to existing nodes. Use this to build connections between concepts, files, people, bugs, decisions, and patterns the user works with.',
        parameters: {
            type: {
                type: 'string',
                description: 'Node type: "entity", "concept", "file", "person", "bug", "decision", or "pattern"',
                required: true,
            },
            name: {
                type: 'string',
                description: 'Name of the entity (e.g. "auth.ts", "Isaac", "JWT", "use RS256")',
                required: true,
            },
            properties: {
                type: 'string',
                description: 'JSON object of key-value properties (e.g. \'{"path":"/src/auth.ts","language":"typescript"}\')',
            },
            connect_to: {
                type: 'string',
                description: 'Comma-separated node IDs to connect this node to',
            },
            relation: {
                type: 'string',
                description: 'Relation type for edges created via connect_to (default: "related_to")',
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const type = String(args.type || '').trim();
            const name = String(args.name || '').trim();
            const validTypes = ['entity', 'concept', 'file', 'person', 'bug', 'decision', 'pattern'];
            if (!validTypes.includes(type)) {
                return `Error: type must be one of: ${validTypes.join(', ')}`;
            }
            if (!name)
                return 'Error: name is required.';
            let properties = {};
            if (args.properties) {
                try {
                    properties = JSON.parse(String(args.properties));
                }
                catch {
                    return 'Error: properties must be valid JSON.';
                }
            }
            load();
            const node = addNode(type, name, properties);
            // Handle optional edge connections
            let edgesCreated = 0;
            if (args.connect_to) {
                const targetIds = String(args.connect_to).split(',').map(s => s.trim()).filter(Boolean);
                const relation = String(args.relation || 'related_to').trim();
                for (const targetId of targetIds) {
                    if (addEdge(node.id, targetId, relation)) {
                        edgesCreated++;
                    }
                }
            }
            save();
            const edgeNote = edgesCreated > 0 ? ` + ${edgesCreated} edge(s) created` : '';
            return `Added [${type}:${name}] (id: ${node.id})${edgeNote}. Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges.`;
        },
    });
    // ── graph_query ──
    registerTool({
        name: 'graph_query',
        description: 'Search the knowledge graph for entities by name or find all edges of a given relation type. Use this to recall known entities and their connections.',
        parameters: {
            query: {
                type: 'string',
                description: 'Search term to fuzzy-match against node names',
            },
            relation: {
                type: 'string',
                description: 'Find all edges of this relation type (e.g. "uses", "authored_by", "fixes")',
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            load();
            const results = [];
            if (args.query) {
                const query = String(args.query).trim();
                const matches = findNode(query);
                if (matches.length === 0) {
                    results.push(`No nodes found matching "${query}".`);
                }
                else {
                    results.push(`Found ${matches.length} node(s) matching "${query}":`);
                    for (const node of matches) {
                        const props = Object.entries(node.properties)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(', ');
                        const propStr = props ? ` (${props})` : '';
                        results.push(`  [${node.type}:${node.name}] id=${node.id} accessed=${node.accessCount}x${propStr}`);
                    }
                }
            }
            if (args.relation) {
                const relation = String(args.relation).trim();
                const edges = queryRelation(relation);
                if (edges.length === 0) {
                    results.push(`No edges found with relation "${relation}".`);
                }
                else {
                    results.push(`\nFound ${edges.length} edge(s) with relation "${relation}":`);
                    for (const edge of edges.slice(0, 20)) {
                        const src = graph.nodes.get(edge.source);
                        const tgt = graph.nodes.get(edge.target);
                        if (src && tgt) {
                            results.push(`  [${src.type}:${src.name}] --${edge.relation}(${edge.weight.toFixed(2)})--> [${tgt.type}:${tgt.name}]`);
                        }
                    }
                    if (edges.length > 20) {
                        results.push(`  ... and ${edges.length - 20} more`);
                    }
                }
            }
            if (!args.query && !args.relation) {
                // Show graph stats
                const stats = getStats();
                results.push(`Graph: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
                results.push('Node types:');
                for (const [type, count] of Object.entries(stats.nodesByType)) {
                    results.push(`  ${type}: ${count}`);
                }
                if (stats.topNodes.length > 0) {
                    results.push('Most accessed:');
                    for (const n of stats.topNodes) {
                        results.push(`  [${n.type}:${n.name}] — ${n.accessCount}x`);
                    }
                }
            }
            save();
            return results.join('\n');
        },
    });
    // ── graph_connect ──
    registerTool({
        name: 'graph_connect',
        description: 'Create a typed relationship edge between two nodes in the knowledge graph. Use this to link entities that are related (e.g. a file uses a library, a person authored a module).',
        parameters: {
            source: {
                type: 'string',
                description: 'Source node ID',
                required: true,
            },
            target: {
                type: 'string',
                description: 'Target node ID',
                required: true,
            },
            relation: {
                type: 'string',
                description: 'Relation type (e.g. "uses", "depends_on", "authored_by", "fixes", "related_to", "implements")',
                required: true,
            },
            weight: {
                type: 'string',
                description: 'Edge weight 0-1 (default: 0.5). Higher = stronger relationship.',
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const sourceId = String(args.source || '').trim();
            const targetId = String(args.target || '').trim();
            const relation = String(args.relation || '').trim();
            const weight = args.weight ? parseFloat(String(args.weight)) : 0.5;
            if (!sourceId || !targetId || !relation) {
                return 'Error: source, target, and relation are all required.';
            }
            load();
            const sourceNode = graph.nodes.get(sourceId);
            const targetNode = graph.nodes.get(targetId);
            if (!sourceNode)
                return `Error: source node "${sourceId}" not found.`;
            if (!targetNode)
                return `Error: target node "${targetId}" not found.`;
            if (addEdge(sourceId, targetId, relation, weight)) {
                save();
                return `Connected [${sourceNode.type}:${sourceNode.name}] --${relation}(${weight.toFixed(2)})--> [${targetNode.type}:${targetNode.name}]`;
            }
            return 'Error: failed to create edge.';
        },
    });
    // ── graph_view ──
    registerTool({
        name: 'graph_view',
        description: 'View the subgraph around a specific node — its neighbors and connections. Use this to understand how an entity relates to others in the knowledge graph.',
        parameters: {
            node_id: {
                type: 'string',
                description: 'The node ID to center the view on',
                required: true,
            },
            depth: {
                type: 'string',
                description: 'How many hops from the center node to include (1-3, default: 1)',
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const nodeId = String(args.node_id || '').trim();
            const depth = args.depth ? Math.max(1, Math.min(3, parseInt(String(args.depth), 10) || 1)) : 1;
            if (!nodeId)
                return 'Error: node_id is required.';
            load();
            const centerNode = graph.nodes.get(nodeId);
            if (!centerNode)
                return `Error: node "${nodeId}" not found.`;
            const { nodes, edges } = getNeighbors(nodeId, depth);
            const lines = [];
            lines.push(`Subgraph around [${centerNode.type}:${centerNode.name}] (depth ${depth}):`);
            lines.push(`  ${nodes.length} node(s), ${edges.length} edge(s)`);
            lines.push('');
            // List nodes
            lines.push('Nodes:');
            for (const node of nodes) {
                const marker = node.id === nodeId ? ' ★' : '';
                lines.push(`  [${node.type}:${node.name}] id=${node.id}${marker}`);
            }
            // List edges
            if (edges.length > 0) {
                lines.push('');
                lines.push('Edges:');
                for (const edge of edges) {
                    const src = graph.nodes.get(edge.source);
                    const tgt = graph.nodes.get(edge.target);
                    if (src && tgt) {
                        lines.push(`  [${src.type}:${src.name}] --${edge.relation}(${edge.weight.toFixed(2)})--> [${tgt.type}:${tgt.name}]`);
                    }
                }
            }
            save();
            return lines.join('\n');
        },
    });
    // ── graph_context ──
    registerTool({
        name: 'graph_context',
        description: 'Get relevant knowledge graph context for the current task. Returns a compact, human-readable summary of the most relevant entities and their connections. Inject this into the system prompt to give the agent structural awareness.',
        parameters: {
            max_tokens: {
                type: 'string',
                description: 'Max approximate tokens for the context output (default: 2000)',
            },
            focus: {
                type: 'string',
                description: 'Optional: a search term to focus the context around specific entities',
            },
        },
        tier: 'free',
        timeout: 10_000,
        async execute(args) {
            const maxTokens = args.max_tokens ? parseInt(String(args.max_tokens), 10) || 2000 : 2000;
            load();
            // If a focus query is provided, boost those nodes first
            if (args.focus) {
                const focusQuery = String(args.focus).trim();
                // Touch focus-related nodes to boost their recency
                findNode(focusQuery); // Side effect: updates lastAccessed on matches
            }
            const context = toContext(maxTokens);
            save();
            return context;
        },
    });
}
//# sourceMappingURL=graph-memory.js.map