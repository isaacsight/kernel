// kbot Science Knowledge Graph — Connects entities across kbot's science tools
// Stores entities and relationships discovered during research sessions.
// Graph persists at ~/.kbot/science-graph.json. No external dependencies.
import { registerTool, getTool } from './index.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
// ─── Domain Classification ──────────────────────────────────────────────────
const TYPE_TO_DOMAIN = {
    gene: 'biology',
    protein: 'biology',
    disease: 'biology',
    pathway: 'biology',
    species: 'biology',
    compound: 'chemistry',
    element: 'chemistry',
    material: 'chemistry',
    paper: 'math', // papers span all domains; default to math as neutral
    concept: 'physics', // concepts span all domains; default to physics as neutral
};
const DOMAIN_TYPES = {
    biology: ['gene', 'protein', 'disease', 'pathway', 'species'],
    chemistry: ['compound', 'element', 'material'],
    physics: ['concept'],
    earth: ['species'], // species can also be earth science
    math: ['paper'],
};
// ─── Graph Storage ──────────────────────────────────────────────────────────
const GRAPH_PATH = join(homedir(), '.kbot', 'science-graph.json');
function ensureDir() {
    const dir = join(homedir(), '.kbot');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
function loadGraph() {
    try {
        if (existsSync(GRAPH_PATH)) {
            const raw = readFileSync(GRAPH_PATH, 'utf-8');
            return JSON.parse(raw);
        }
    }
    catch {
        // corrupted file — start fresh
    }
    const now = new Date().toISOString();
    return {
        entities: {},
        relations: [],
        metadata: { created: now, lastModified: now, entityCount: 0, relationCount: 0 },
    };
}
function saveGraph(graph) {
    ensureDir();
    graph.metadata.lastModified = new Date().toISOString();
    graph.metadata.entityCount = Object.keys(graph.entities).length;
    graph.metadata.relationCount = graph.relations.length;
    writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2), 'utf-8');
}
// ─── ID Generation ──────────────────────────────────────────────────────────
function entityId(name, type) {
    return `${type}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}
// ─── Fuzzy Match ────────────────────────────────────────────────────────────
function fuzzyMatch(needle, haystack) {
    const n = needle.toLowerCase();
    const h = haystack.toLowerCase();
    if (h.includes(n) || n.includes(h))
        return true;
    // Levenshtein for short strings
    if (n.length <= 20 && h.length <= 20) {
        const dist = levenshtein(n, h);
        return dist <= Math.max(1, Math.floor(Math.min(n.length, h.length) * 0.3));
    }
    return false;
}
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}
// ─── Graph Algorithms ───────────────────────────────────────────────────────
/** Build adjacency list from relations */
function buildAdjacency(graph) {
    const adj = new Map();
    for (const rel of graph.relations) {
        if (!adj.has(rel.from))
            adj.set(rel.from, []);
        if (!adj.has(rel.to))
            adj.set(rel.to, []);
        adj.get(rel.from).push({ neighbor: rel.to, relation: rel });
        adj.get(rel.to).push({ neighbor: rel.from, relation: rel });
    }
    return adj;
}
/** BFS shortest path between two entity IDs */
function bfsPath(adj, startId, endId, maxDepth) {
    if (startId === endId)
        return [{ entity: startId, relation: null }];
    const visited = new Set([startId]);
    const parent = new Map();
    const queue = [{ id: startId, depth: 0 }];
    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (depth >= maxDepth)
            continue;
        const neighbors = adj.get(id) || [];
        for (const { neighbor, relation } of neighbors) {
            if (visited.has(neighbor))
                continue;
            visited.add(neighbor);
            parent.set(neighbor, { from: id, relation });
            if (neighbor === endId) {
                // reconstruct path
                const path = [];
                let cur = endId;
                while (cur !== startId) {
                    const p = parent.get(cur);
                    path.unshift({ entity: cur, relation: p.relation });
                    cur = p.from;
                }
                path.unshift({ entity: startId, relation: null });
                return path;
            }
            queue.push({ id: neighbor, depth: depth + 1 });
        }
    }
    return null;
}
/** BFS to find all entities within maxDepth of a start entity */
function bfsNeighbors(adj, startId, maxDepth) {
    const result = new Map();
    const visited = new Set([startId]);
    const queue = [{ id: startId, depth: 0 }];
    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (depth >= maxDepth)
            continue;
        const neighbors = adj.get(id) || [];
        for (const { neighbor, relation } of neighbors) {
            if (visited.has(neighbor))
                continue;
            visited.add(neighbor);
            result.set(neighbor, { depth: depth + 1, relations: [relation] });
            queue.push({ id: neighbor, depth: depth + 1 });
        }
    }
    return result;
}
/** Compute degree centrality for all entities */
function degreeCentrality(graph) {
    const degrees = new Map();
    for (const id of Object.keys(graph.entities)) {
        degrees.set(id, 0);
    }
    for (const rel of graph.relations) {
        degrees.set(rel.from, (degrees.get(rel.from) || 0) + 1);
        degrees.set(rel.to, (degrees.get(rel.to) || 0) + 1);
    }
    return degrees;
}
/** Find entity ID by fuzzy name match */
function findEntityByName(graph, name) {
    // exact ID match first
    const id = Object.keys(graph.entities).find(k => k === name);
    if (id)
        return graph.entities[id];
    // exact name match
    const exact = Object.values(graph.entities).find(e => e.name.toLowerCase() === name.toLowerCase());
    if (exact)
        return exact;
    // fuzzy match
    const fuzzy = Object.values(graph.entities).find(e => fuzzyMatch(name, e.name));
    return fuzzy || null;
}
// ─── Entity Type Validation ─────────────────────────────────────────────────
const VALID_ENTITY_TYPES = ['gene', 'protein', 'compound', 'disease', 'pathway', 'species', 'element', 'material', 'paper', 'concept'];
const VALID_RELATION_TYPES = ['targets', 'inhibits', 'causes', 'treats', 'contains', 'catalyzes', 'encodes', 'interacts_with', 'associated_with', 'cites', 'similar_to'];
// ─── Registration ───────────────────────────────────────────────────────────
export function registerScienceGraphTools() {
    // ════════════════════════════════════════════════════════════════════════════
    // 1. graph_add_entity — Add a scientific entity to the knowledge graph
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_add_entity',
        description: 'Add a scientific entity to the Science Knowledge Graph. Entities represent genes, proteins, compounds, diseases, pathways, species, elements, materials, papers, or concepts discovered during research.',
        parameters: {
            name: { type: 'string', description: 'Entity name (e.g., "TP53", "Aspirin", "Alzheimer\'s Disease")', required: true },
            type: { type: 'string', description: 'Entity type: gene, protein, compound, disease, pathway, species, element, material, paper, concept', required: true },
            properties: { type: 'string', description: 'JSON string of additional properties (e.g., \'{"symbol":"TP53","chromosome":"17"}\')' },
            source: { type: 'string', description: 'Which tool or source discovered this entity (e.g., "gene_lookup", "pubmed_search", "manual")', required: true },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.name).trim();
            const type = String(args.type).trim().toLowerCase();
            const source = String(args.source || 'manual').trim();
            if (!name)
                return '**Error**: Entity name is required.';
            if (!VALID_ENTITY_TYPES.includes(type)) {
                return `**Error**: Invalid entity type "${type}". Valid types: ${VALID_ENTITY_TYPES.join(', ')}`;
            }
            let properties = {};
            if (args.properties) {
                try {
                    properties = JSON.parse(String(args.properties));
                }
                catch {
                    return '**Error**: Invalid JSON in properties parameter.';
                }
            }
            const graph = loadGraph();
            const id = entityId(name, type);
            const now = new Date().toISOString();
            if (graph.entities[id]) {
                // Update existing entity
                const existing = graph.entities[id];
                existing.lastSeen = now;
                existing.references++;
                existing.properties = { ...existing.properties, ...properties };
                if (source && source !== existing.source) {
                    existing.source = `${existing.source}, ${source}`;
                }
                saveGraph(graph);
                return `## Entity Updated\n\n| Field | Value |\n|---|---|\n| **ID** | \`${id}\` |\n| **Name** | ${existing.name} |\n| **Type** | ${existing.type} |\n| **References** | ${existing.references} |\n| **Sources** | ${existing.source} |\n| **Properties** | ${Object.keys(existing.properties).length} fields |\n\nEntity already existed — incremented reference count and merged properties.`;
            }
            const entity = {
                id,
                name,
                type,
                properties,
                source,
                created: now,
                lastSeen: now,
                references: 1,
            };
            graph.entities[id] = entity;
            saveGraph(graph);
            return `## Entity Added\n\n| Field | Value |\n|---|---|\n| **ID** | \`${id}\` |\n| **Name** | ${name} |\n| **Type** | ${type} |\n| **Source** | ${source} |\n| **Properties** | ${Object.keys(properties).length} fields |\n\nGraph now contains **${graph.metadata.entityCount}** entities and **${graph.metadata.relationCount}** relations.`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 2. graph_add_relation — Add a relationship between two entities
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_add_relation',
        description: 'Add a relationship between two entities in the Science Knowledge Graph. Both entities must already exist. Relation types: targets, inhibits, causes, treats, contains, catalyzes, encodes, interacts_with, associated_with, cites, similar_to.',
        parameters: {
            from_entity: { type: 'string', description: 'Name or ID of the source entity', required: true },
            to_entity: { type: 'string', description: 'Name or ID of the target entity', required: true },
            relation_type: { type: 'string', description: 'Relationship type: targets, inhibits, causes, treats, contains, catalyzes, encodes, interacts_with, associated_with, cites, similar_to', required: true },
            confidence: { type: 'number', description: 'Confidence score 0-1 (default 0.8)' },
            evidence: { type: 'string', description: 'Supporting evidence or reference for this relationship', required: true },
        },
        tier: 'free',
        async execute(args) {
            const fromName = String(args.from_entity).trim();
            const toName = String(args.to_entity).trim();
            const relType = String(args.relation_type).trim().toLowerCase();
            const confidence = typeof args.confidence === 'number' ? Math.max(0, Math.min(1, args.confidence)) : 0.8;
            const evidence = String(args.evidence || '').trim();
            if (!fromName || !toName)
                return '**Error**: Both from_entity and to_entity are required.';
            if (!VALID_RELATION_TYPES.includes(relType)) {
                return `**Error**: Invalid relation type "${relType}". Valid types: ${VALID_RELATION_TYPES.join(', ')}`;
            }
            const graph = loadGraph();
            const fromEntity = findEntityByName(graph, fromName);
            const toEntity = findEntityByName(graph, toName);
            if (!fromEntity)
                return `**Error**: Entity "${fromName}" not found in graph. Add it first with graph_add_entity.`;
            if (!toEntity)
                return `**Error**: Entity "${toName}" not found in graph. Add it first with graph_add_entity.`;
            // Check for duplicate relation
            const duplicate = graph.relations.find(r => r.from === fromEntity.id && r.to === toEntity.id && r.type === relType);
            if (duplicate) {
                // Update confidence if higher
                if (confidence > duplicate.confidence) {
                    duplicate.confidence = confidence;
                    duplicate.evidence = evidence || duplicate.evidence;
                    saveGraph(graph);
                    return `## Relation Updated\n\n**${fromEntity.name}** --[${relType}]--> **${toEntity.name}**\n\nConfidence upgraded to **${confidence}**. Evidence: ${evidence || duplicate.evidence}`;
                }
                return `## Relation Already Exists\n\n**${fromEntity.name}** --[${relType}]--> **${toEntity.name}** (confidence: ${duplicate.confidence})\n\nExisting relation unchanged (new confidence ${confidence} <= existing ${duplicate.confidence}).`;
            }
            const relation = {
                from: fromEntity.id,
                to: toEntity.id,
                type: relType,
                confidence,
                evidence,
                source: 'manual',
                created: new Date().toISOString(),
            };
            graph.relations.push(relation);
            saveGraph(graph);
            return `## Relation Added\n\n**${fromEntity.name}** --[${relType}]--> **${toEntity.name}**\n\n| Field | Value |\n|---|---|\n| **Confidence** | ${confidence} |\n| **Evidence** | ${evidence || 'None provided'} |\n\nGraph now contains **${graph.metadata.entityCount}** entities and **${graph.metadata.relationCount}** relations.`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 3. graph_query — Query the knowledge graph
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_query',
        description: 'Query the Science Knowledge Graph. Find entities by name (fuzzy), trace shortest paths between entities (BFS), find neighbors within depth, list all entities of a type, or dump all entities.',
        parameters: {
            query: { type: 'string', description: 'Search term: entity name for entity/neighbors, "A -> B" for path finding, type name for type queries', required: true },
            query_type: { type: 'string', description: 'Query mode: entity (fuzzy name search), path (shortest path between two entities separated by "->"), neighbors (connected entities within depth), type (all entities of a given type), all (full listing)', required: true },
            max_depth: { type: 'number', description: 'Maximum search depth for path/neighbors queries (default 2, max 5)' },
        },
        tier: 'free',
        async execute(args) {
            const query = String(args.query).trim();
            const queryType = String(args.query_type).trim().toLowerCase();
            const maxDepth = Math.min(typeof args.max_depth === 'number' ? args.max_depth : 2, 5);
            const graph = loadGraph();
            if (Object.keys(graph.entities).length === 0) {
                return '## Empty Graph\n\nThe Science Knowledge Graph is empty. Use `graph_add_entity` to add entities.';
            }
            const adj = buildAdjacency(graph);
            // ── entity: fuzzy search
            if (queryType === 'entity') {
                const matches = Object.values(graph.entities).filter(e => fuzzyMatch(query, e.name) || fuzzyMatch(query, e.id));
                if (matches.length === 0)
                    return `## No Matches\n\nNo entities matching "${query}" found in the graph.`;
                const lines = matches.map(e => {
                    const rels = graph.relations.filter(r => r.from === e.id || r.to === e.id);
                    return `### ${e.name} (\`${e.type}\`)\n- **ID**: \`${e.id}\`\n- **Source**: ${e.source}\n- **References**: ${e.references}\n- **Relations**: ${rels.length}\n- **Properties**: ${JSON.stringify(e.properties)}`;
                });
                return `## Entity Search: "${query}"\n\nFound **${matches.length}** matching entities:\n\n${lines.join('\n\n')}`;
            }
            // ── path: BFS shortest path
            if (queryType === 'path') {
                const parts = query.split('->').map(s => s.trim());
                if (parts.length !== 2)
                    return '**Error**: Path query requires format "Entity A -> Entity B".';
                const startEntity = findEntityByName(graph, parts[0]);
                const endEntity = findEntityByName(graph, parts[1]);
                if (!startEntity)
                    return `**Error**: Entity "${parts[0]}" not found.`;
                if (!endEntity)
                    return `**Error**: Entity "${parts[1]}" not found.`;
                const path = bfsPath(adj, startEntity.id, endEntity.id, maxDepth);
                if (!path)
                    return `## No Path Found\n\nNo path between **${startEntity.name}** and **${endEntity.name}** within depth ${maxDepth}.`;
                const steps = path.map((step, i) => {
                    const entity = graph.entities[step.entity];
                    const entityName = entity ? entity.name : step.entity;
                    if (i === 0)
                        return `1. **${entityName}** (\`${entity?.type}\`)`;
                    const rel = step.relation;
                    const relLabel = rel ? `--[${rel.type}, confidence: ${rel.confidence}]-->` : '-->';
                    return `${i + 1}. ${relLabel} **${entityName}** (\`${entity?.type}\`)`;
                });
                return `## Path: ${startEntity.name} → ${endEntity.name}\n\nShortest path (${path.length - 1} hops):\n\n${steps.join('\n')}`;
            }
            // ── neighbors: BFS within depth
            if (queryType === 'neighbors') {
                const entity = findEntityByName(graph, query);
                if (!entity)
                    return `**Error**: Entity "${query}" not found.`;
                const neighbors = bfsNeighbors(adj, entity.id, maxDepth);
                if (neighbors.size === 0)
                    return `## No Neighbors\n\n**${entity.name}** has no connections within depth ${maxDepth}.`;
                const byDepth = new Map();
                for (const [nId, info] of neighbors) {
                    const n = graph.entities[nId];
                    if (!n)
                        continue;
                    if (!byDepth.has(info.depth))
                        byDepth.set(info.depth, []);
                    const relDesc = info.relations.map(r => r.type).join(', ');
                    byDepth.get(info.depth).push(`- **${n.name}** (\`${n.type}\`) via ${relDesc}`);
                }
                const sections = Array.from(byDepth.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([depth, items]) => `### Depth ${depth}\n${items.join('\n')}`);
                return `## Neighbors of ${entity.name}\n\nFound **${neighbors.size}** connected entities within depth ${maxDepth}:\n\n${sections.join('\n\n')}`;
            }
            // ── type: list all entities of a given type
            if (queryType === 'type') {
                const typeName = query.toLowerCase();
                const matches = Object.values(graph.entities).filter(e => e.type === typeName);
                if (matches.length === 0)
                    return `## No Entities of Type "${query}"\n\nNo entities of type \`${typeName}\` found.`;
                const lines = matches
                    .sort((a, b) => b.references - a.references)
                    .map(e => `| ${e.name} | ${e.source} | ${e.references} | ${e.created.split('T')[0]} |`);
                return `## Entities of Type: ${typeName}\n\nFound **${matches.length}** entities:\n\n| Name | Source | References | Created |\n|---|---|---|---|\n${lines.join('\n')}`;
            }
            // ── all: full listing
            if (queryType === 'all') {
                const entities = Object.values(graph.entities);
                const byType = new Map();
                for (const e of entities) {
                    if (!byType.has(e.type))
                        byType.set(e.type, []);
                    byType.get(e.type).push(e);
                }
                const sections = Array.from(byType.entries()).map(([type, ents]) => {
                    const rows = ents.slice(0, 20).map(e => `| ${e.name} | ${e.references} | ${e.source} |`);
                    return `### ${type} (${ents.length})\n| Name | Refs | Source |\n|---|---|---|\n${rows.join('\n')}`;
                });
                return `## Full Knowledge Graph\n\n**${graph.metadata.entityCount}** entities, **${graph.metadata.relationCount}** relations\n\n${sections.join('\n\n')}`;
            }
            return `**Error**: Unknown query_type "${queryType}". Use: entity, path, neighbors, type, all.`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 4. graph_connect — Discover connections between two entities
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_connect',
        description: 'Automatically discover connections between two entities by searching for direct relations, shared neighbors, indirect paths (up to depth 3), and common properties.',
        parameters: {
            entity_a: { type: 'string', description: 'First entity name or ID', required: true },
            entity_b: { type: 'string', description: 'Second entity name or ID', required: true },
        },
        tier: 'free',
        async execute(args) {
            const nameA = String(args.entity_a).trim();
            const nameB = String(args.entity_b).trim();
            const graph = loadGraph();
            const entityA = findEntityByName(graph, nameA);
            const entityB = findEntityByName(graph, nameB);
            if (!entityA)
                return `**Error**: Entity "${nameA}" not found.`;
            if (!entityB)
                return `**Error**: Entity "${nameB}" not found.`;
            const adj = buildAdjacency(graph);
            const sections = [];
            // ── Direct relations
            const directRels = graph.relations.filter(r => (r.from === entityA.id && r.to === entityB.id) ||
                (r.from === entityB.id && r.to === entityA.id));
            if (directRels.length > 0) {
                const lines = directRels.map(r => {
                    const fromName = graph.entities[r.from]?.name || r.from;
                    const toName = graph.entities[r.to]?.name || r.to;
                    return `- **${fromName}** --[${r.type}]--> **${toName}** (confidence: ${r.confidence})`;
                });
                sections.push(`### Direct Relations\n${lines.join('\n')}`);
            }
            else {
                sections.push('### Direct Relations\nNone found.');
            }
            // ── Shared neighbors
            const neighborsA = bfsNeighbors(adj, entityA.id, 1);
            const neighborsB = bfsNeighbors(adj, entityB.id, 1);
            const sharedNeighborIds = [...neighborsA.keys()].filter(id => neighborsB.has(id));
            if (sharedNeighborIds.length > 0) {
                const lines = sharedNeighborIds.map(id => {
                    const n = graph.entities[id];
                    return n ? `- **${n.name}** (\`${n.type}\`)` : `- \`${id}\``;
                });
                sections.push(`### Shared Neighbors (${sharedNeighborIds.length})\n${lines.join('\n')}`);
            }
            else {
                sections.push('### Shared Neighbors\nNone found.');
            }
            // ── Shortest path (up to depth 3)
            if (directRels.length === 0) {
                const path = bfsPath(adj, entityA.id, entityB.id, 3);
                if (path && path.length > 2) {
                    const steps = path.map((step, i) => {
                        const entity = graph.entities[step.entity];
                        const name = entity ? entity.name : step.entity;
                        if (i === 0)
                            return `**${name}**`;
                        return `--[${step.relation?.type}]--> **${name}**`;
                    });
                    sections.push(`### Indirect Path (${path.length - 1} hops)\n${steps.join(' ')}`);
                }
                else if (!path) {
                    sections.push('### Indirect Path\nNo path found within 3 hops.');
                }
            }
            // ── Common properties
            const propsA = Object.keys(entityA.properties);
            const propsB = Object.keys(entityB.properties);
            const commonKeys = propsA.filter(k => propsB.includes(k));
            if (commonKeys.length > 0) {
                const lines = commonKeys.map(k => `- **${k}**: ${JSON.stringify(entityA.properties[k])} (A) / ${JSON.stringify(entityB.properties[k])} (B)`);
                sections.push(`### Common Properties (${commonKeys.length})\n${lines.join('\n')}`);
            }
            // ── Same type?
            if (entityA.type === entityB.type) {
                sections.push(`### Same Type\nBoth entities are of type \`${entityA.type}\`, suggesting they may be comparable.`);
            }
            else {
                sections.push(`### Cross-Type\n**${entityA.name}** is \`${entityA.type}\` (${TYPE_TO_DOMAIN[entityA.type]}), **${entityB.name}** is \`${entityB.type}\` (${TYPE_TO_DOMAIN[entityB.type]}).`);
            }
            return `## Connections: ${entityA.name} ↔ ${entityB.name}\n\n${sections.join('\n\n')}`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 5. graph_enrich — Auto-enrich an entity using science tools
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_enrich',
        description: 'Auto-enrich a knowledge graph entity by calling relevant science tools based on its type. For example, a gene entity triggers gene_lookup + pathway_search; a compound triggers compound_search + compound_properties. Discovered relations are stored in the graph automatically.',
        parameters: {
            entity_name: { type: 'string', description: 'Name of the entity to enrich (must already exist in the graph)', required: true },
        },
        tier: 'free',
        async execute(args) {
            const name = String(args.entity_name).trim();
            const graph = loadGraph();
            const entity = findEntityByName(graph, name);
            if (!entity)
                return `**Error**: Entity "${name}" not found. Add it first with graph_add_entity.`;
            const toolCalls = [];
            // Determine which tools to call based on entity type
            switch (entity.type) {
                case 'gene':
                    toolCalls.push({ toolName: 'gene_lookup', args: { gene: entity.name }, purpose: 'gene information' }, { toolName: 'pathway_search', args: { query: entity.name }, purpose: 'associated pathways' });
                    break;
                case 'protein':
                    toolCalls.push({ toolName: 'protein_search', args: { query: entity.name }, purpose: 'protein information' }, { toolName: 'protein_structure', args: { query: entity.name }, purpose: 'structural data' });
                    break;
                case 'compound':
                    toolCalls.push({ toolName: 'compound_search', args: { query: entity.name }, purpose: 'compound identification' }, { toolName: 'compound_properties', args: { query: entity.name }, purpose: 'chemical properties' });
                    break;
                case 'disease':
                    toolCalls.push({ toolName: 'disease_info', args: { disease: entity.name }, purpose: 'disease information' }, { toolName: 'clinical_trials', args: { query: entity.name }, purpose: 'clinical trial data' });
                    break;
                case 'element':
                    toolCalls.push({ toolName: 'element_info', args: { element: entity.name }, purpose: 'element data' });
                    break;
                case 'species':
                    toolCalls.push({ toolName: 'taxonomy_lookup', args: { query: entity.name }, purpose: 'taxonomic classification' }, { toolName: 'ecology_data', args: { species: entity.name }, purpose: 'ecological information' });
                    break;
                case 'pathway':
                    toolCalls.push({ toolName: 'pathway_search', args: { query: entity.name }, purpose: 'pathway details' });
                    break;
                default:
                    return `## Enrichment Not Available\n\nNo automatic enrichment tools mapped for entity type \`${entity.type}\`. Enrich manually by adding relations with graph_add_relation.`;
            }
            const results = [];
            let relationsAdded = 0;
            for (const call of toolCalls) {
                const tool = getTool(call.toolName);
                if (!tool) {
                    results.push(`- **${call.toolName}**: Tool not loaded (science tools may need lazy registration)`);
                    continue;
                }
                try {
                    const result = await tool.execute(call.args);
                    const preview = result.length > 300 ? result.slice(0, 300) + '...' : result;
                    results.push(`- **${call.toolName}** (${call.purpose}): Retrieved data (${result.length} chars)`);
                    // Extract entity names mentioned in the result and auto-link
                    // Look for existing entities referenced in the tool output
                    for (const existingEntity of Object.values(graph.entities)) {
                        if (existingEntity.id === entity.id)
                            continue;
                        if (result.toLowerCase().includes(existingEntity.name.toLowerCase()) && existingEntity.name.length > 2) {
                            // Check if relation already exists
                            const existing = graph.relations.find(r => (r.from === entity.id && r.to === existingEntity.id) ||
                                (r.from === existingEntity.id && r.to === entity.id));
                            if (!existing) {
                                graph.relations.push({
                                    from: entity.id,
                                    to: existingEntity.id,
                                    type: 'associated_with',
                                    confidence: 0.6,
                                    evidence: `Co-occurrence in ${call.toolName} result`,
                                    source: call.toolName,
                                    created: new Date().toISOString(),
                                });
                                relationsAdded++;
                            }
                        }
                    }
                    // Update entity properties with enrichment source
                    entity.properties[`enriched_by_${call.toolName}`] = true;
                    entity.lastSeen = new Date().toISOString();
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    results.push(`- **${call.toolName}** (${call.purpose}): Failed — ${msg}`);
                }
            }
            saveGraph(graph);
            return `## Enrichment: ${entity.name} (\`${entity.type}\`)\n\n### Tool Results\n${results.join('\n')}\n\n### Graph Updates\n- **${relationsAdded}** new relations discovered and added\n- Entity properties updated with enrichment markers\n\nUse \`graph_query\` to explore the updated connections.`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 6. graph_visualize — Generate visual representations of the graph
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_visualize',
        description: 'Generate a text-based, Mermaid diagram, or statistics view of the Science Knowledge Graph. Optionally focus on a subgraph around a specific entity.',
        parameters: {
            center_entity: { type: 'string', description: 'Optional: show subgraph centered on this entity (name or ID). Omit for full graph.' },
            format: { type: 'string', description: 'Output format: mermaid (Mermaid diagram syntax), text (ASCII representation), stats (counts, centrality, orphans)', required: true },
        },
        tier: 'free',
        async execute(args) {
            const centerName = args.center_entity ? String(args.center_entity).trim() : '';
            const format = String(args.format).trim().toLowerCase();
            const graph = loadGraph();
            if (Object.keys(graph.entities).length === 0) {
                return '## Empty Graph\n\nThe Science Knowledge Graph is empty. Add entities with `graph_add_entity`.';
            }
            // Determine which entities and relations to include
            let entities;
            let relations;
            if (centerName) {
                const center = findEntityByName(graph, centerName);
                if (!center)
                    return `**Error**: Entity "${centerName}" not found.`;
                const adj = buildAdjacency(graph);
                const neighbors = bfsNeighbors(adj, center.id, 2);
                const relevantIds = new Set([center.id, ...neighbors.keys()]);
                entities = Object.values(graph.entities).filter(e => relevantIds.has(e.id));
                relations = graph.relations.filter(r => relevantIds.has(r.from) && relevantIds.has(r.to));
            }
            else {
                entities = Object.values(graph.entities);
                relations = graph.relations;
            }
            // ── Mermaid format
            if (format === 'mermaid') {
                const nodeIds = new Map();
                let nodeCounter = 0;
                const getNodeId = (id) => {
                    if (!nodeIds.has(id))
                        nodeIds.set(id, `N${nodeCounter++}`);
                    return nodeIds.get(id);
                };
                const lines = ['graph LR'];
                // Subgraphs by type
                const byType = new Map();
                for (const e of entities) {
                    if (!byType.has(e.type))
                        byType.set(e.type, []);
                    byType.get(e.type).push(e);
                }
                for (const [type, ents] of byType) {
                    lines.push(`  subgraph ${type}`);
                    for (const e of ents) {
                        const nid = getNodeId(e.id);
                        const label = e.name.replace(/"/g, "'");
                        lines.push(`    ${nid}["${label}"]`);
                    }
                    lines.push('  end');
                }
                // Edges
                for (const r of relations) {
                    const fromNode = getNodeId(r.from);
                    const toNode = getNodeId(r.to);
                    const label = r.type.replace(/_/g, ' ');
                    lines.push(`  ${fromNode} -->|${label}| ${toNode}`);
                }
                const title = centerName ? `Subgraph around ${centerName}` : 'Full Science Knowledge Graph';
                return `## ${title}\n\n\`\`\`mermaid\n${lines.join('\n')}\n\`\`\`\n\n*${entities.length} entities, ${relations.length} relations*`;
            }
            // ── Text format (ASCII)
            if (format === 'text') {
                const lines = [];
                const title = centerName ? `Subgraph: ${centerName}` : 'Science Knowledge Graph';
                lines.push(`╔${'═'.repeat(title.length + 2)}╗`);
                lines.push(`║ ${title} ║`);
                lines.push(`╚${'═'.repeat(title.length + 2)}╝`);
                lines.push('');
                // List entities grouped by type
                const byType = new Map();
                for (const e of entities) {
                    if (!byType.has(e.type))
                        byType.set(e.type, []);
                    byType.get(e.type).push(e);
                }
                for (const [type, ents] of byType) {
                    lines.push(`┌─ ${type.toUpperCase()} (${ents.length}) ${'─'.repeat(Math.max(0, 40 - type.length - String(ents.length).length))}┐`);
                    for (const e of ents) {
                        const relCount = relations.filter(r => r.from === e.id || r.to === e.id).length;
                        lines.push(`│  ● ${e.name} (${relCount} relations)`);
                    }
                    lines.push(`└${'─'.repeat(50)}┘`);
                    lines.push('');
                }
                // List relations
                if (relations.length > 0) {
                    lines.push(`┌─ RELATIONS (${relations.length}) ${'─'.repeat(30)}┐`);
                    for (const r of relations.slice(0, 50)) {
                        const fromName = graph.entities[r.from]?.name || r.from;
                        const toName = graph.entities[r.to]?.name || r.to;
                        const conf = (r.confidence * 100).toFixed(0);
                        lines.push(`│  ${fromName} ──[${r.type}]──▶ ${toName} (${conf}%)`);
                    }
                    if (relations.length > 50) {
                        lines.push(`│  ... and ${relations.length - 50} more`);
                    }
                    lines.push(`└${'─'.repeat(50)}┘`);
                }
                return lines.join('\n');
            }
            // ── Stats format
            if (format === 'stats') {
                const degrees = degreeCentrality(graph);
                // Type counts
                const typeCounts = new Map();
                for (const e of entities) {
                    typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
                }
                // Relation type counts
                const relTypeCounts = new Map();
                for (const r of relations) {
                    relTypeCounts.set(r.type, (relTypeCounts.get(r.type) || 0) + 1);
                }
                // Most connected
                const sortedDegrees = [...degrees.entries()]
                    .filter(([id]) => entities.find(e => e.id === id))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                // Orphans (no relations)
                const connectedIds = new Set();
                for (const r of relations) {
                    connectedIds.add(r.from);
                    connectedIds.add(r.to);
                }
                const orphans = entities.filter(e => !connectedIds.has(e.id));
                // Avg confidence
                const avgConfidence = relations.length > 0
                    ? (relations.reduce((sum, r) => sum + r.confidence, 0) / relations.length).toFixed(2)
                    : 'N/A';
                const typeRows = [...typeCounts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => `| ${type} | ${count} |`);
                const relTypeRows = [...relTypeCounts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => `| ${type} | ${count} |`);
                const centralityRows = sortedDegrees.map(([id, deg]) => {
                    const e = graph.entities[id];
                    return `| ${e?.name || id} | ${e?.type || '?'} | ${deg} |`;
                });
                const orphanList = orphans.length > 0
                    ? orphans.slice(0, 15).map(e => `- ${e.name} (\`${e.type}\`)`).join('\n')
                    : 'None — all entities are connected.';
                return `## Graph Statistics\n\n| Metric | Value |\n|---|---|\n| **Entities** | ${entities.length} |\n| **Relations** | ${relations.length} |\n| **Avg Confidence** | ${avgConfidence} |\n| **Orphan Entities** | ${orphans.length} |\n| **Created** | ${graph.metadata.created.split('T')[0]} |\n| **Last Modified** | ${graph.metadata.lastModified.split('T')[0]} |\n\n### Entities by Type\n| Type | Count |\n|---|---|\n${typeRows.join('\n')}\n\n### Relations by Type\n| Type | Count |\n|---|---|\n${relTypeRows.join('\n')}\n\n### Most Connected Entities\n| Entity | Type | Degree |\n|---|---|---|\n${centralityRows.join('\n')}\n\n### Orphan Entities (unconnected)\n${orphanList}`;
            }
            return `**Error**: Unknown format "${format}". Use: mermaid, text, stats.`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 7. graph_cross_domain — Find cross-domain connections
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_cross_domain',
        description: 'Find cross-domain connections in the Science Knowledge Graph: entities from different scientific fields (biology, chemistry, physics, earth, math) that share properties or relationships. Useful for discovering interdisciplinary insights.',
        parameters: {
            domain_a: { type: 'string', description: 'Primary domain: biology, chemistry, physics, earth, math', required: true },
            domain_b: { type: 'string', description: 'Secondary domain to compare (omit to check all other domains)' },
        },
        tier: 'free',
        async execute(args) {
            const domainA = String(args.domain_a).trim().toLowerCase();
            const domainB = args.domain_b ? String(args.domain_b).trim().toLowerCase() : null;
            const validDomains = ['biology', 'chemistry', 'physics', 'earth', 'math'];
            if (!validDomains.includes(domainA)) {
                return `**Error**: Invalid domain "${domainA}". Valid: ${validDomains.join(', ')}`;
            }
            if (domainB && !validDomains.includes(domainB)) {
                return `**Error**: Invalid domain "${domainB}". Valid: ${validDomains.join(', ')}`;
            }
            const graph = loadGraph();
            // Classify entities by domain
            const domainEntities = new Map();
            for (const domain of validDomains) {
                domainEntities.set(domain, []);
            }
            for (const entity of Object.values(graph.entities)) {
                const domain = TYPE_TO_DOMAIN[entity.type];
                if (domain)
                    domainEntities.get(domain).push(entity);
            }
            const entitiesA = domainEntities.get(domainA) || [];
            if (entitiesA.length === 0) {
                return `## No Entities in ${domainA}\n\nNo entities classified under the **${domainA}** domain.`;
            }
            const targetDomains = domainB ? [domainB] : validDomains.filter(d => d !== domainA);
            const sections = [];
            for (const targetDomain of targetDomains) {
                const entitiesB = domainEntities.get(targetDomain) || [];
                if (entitiesB.length === 0)
                    continue;
                const idsA = new Set(entitiesA.map(e => e.id));
                const idsB = new Set(entitiesB.map(e => e.id));
                // Find cross-domain relations
                const crossRelations = graph.relations.filter(r => (idsA.has(r.from) && idsB.has(r.to)) ||
                    (idsB.has(r.from) && idsA.has(r.to)));
                // Find bridge entities (connected to both domains)
                const allIds = new Set([...Object.keys(graph.entities)]);
                const bridges = [];
                for (const entity of Object.values(graph.entities)) {
                    if (idsA.has(entity.id) || idsB.has(entity.id))
                        continue;
                    const connsA = graph.relations.filter(r => (r.from === entity.id && idsA.has(r.to)) || (r.to === entity.id && idsA.has(r.from))).length;
                    const connsB = graph.relations.filter(r => (r.from === entity.id && idsB.has(r.to)) || (r.to === entity.id && idsB.has(r.from))).length;
                    if (connsA > 0 && connsB > 0) {
                        bridges.push({ entity, connectionsA: connsA, connectionsB: connsB });
                    }
                }
                // Find shared properties across domains
                const sharedProps = [];
                for (const eA of entitiesA) {
                    for (const eB of entitiesB) {
                        for (const key of Object.keys(eA.properties)) {
                            if (key in eB.properties) {
                                sharedProps.push({ propKey: key, entityA: eA, entityB: eB, valueA: eA.properties[key], valueB: eB.properties[key] });
                            }
                        }
                    }
                }
                const parts = [];
                parts.push(`### ${domainA} ↔ ${targetDomain}`);
                if (crossRelations.length > 0) {
                    const relLines = crossRelations.slice(0, 15).map(r => {
                        const from = graph.entities[r.from]?.name || r.from;
                        const to = graph.entities[r.to]?.name || r.to;
                        return `- **${from}** --[${r.type}]--> **${to}** (${(r.confidence * 100).toFixed(0)}%)`;
                    });
                    parts.push(`**Direct Cross-Domain Relations (${crossRelations.length})**\n${relLines.join('\n')}`);
                }
                if (bridges.length > 0) {
                    const bridgeLines = bridges
                        .sort((a, b) => (b.connectionsA + b.connectionsB) - (a.connectionsA + a.connectionsB))
                        .slice(0, 10)
                        .map(b => `- **${b.entity.name}** (\`${b.entity.type}\`): ${b.connectionsA} ${domainA} links, ${b.connectionsB} ${targetDomain} links`);
                    parts.push(`**Bridge Entities (${bridges.length})**\n${bridgeLines.join('\n')}`);
                }
                if (sharedProps.length > 0) {
                    const propLines = sharedProps.slice(0, 10).map(sp => `- Property \`${sp.propKey}\`: **${sp.entityA.name}** = ${JSON.stringify(sp.valueA)}, **${sp.entityB.name}** = ${JSON.stringify(sp.valueB)}`);
                    parts.push(`**Shared Properties (${sharedProps.length})**\n${propLines.join('\n')}`);
                }
                if (crossRelations.length === 0 && bridges.length === 0 && sharedProps.length === 0) {
                    parts.push('*No cross-domain connections found between these domains.*');
                }
                sections.push(parts.join('\n\n'));
            }
            const domainSummary = validDomains.map(d => `${d}: ${(domainEntities.get(d) || []).length}`).join(', ');
            return `## Cross-Domain Analysis: ${domainA}${domainB ? ` ↔ ${domainB}` : ' ↔ all'}\n\n**Domain sizes**: ${domainSummary}\n\n${sections.join('\n\n---\n\n')}`;
        },
    });
    // ════════════════════════════════════════════════════════════════════════════
    // 8. graph_export — Export the knowledge graph in various formats
    // ════════════════════════════════════════════════════════════════════════════
    registerTool({
        name: 'graph_export',
        description: 'Export the Science Knowledge Graph in JSON, CSV, GraphML (Cytoscape/Gephi compatible), or Markdown format. Optionally filter by entity type.',
        parameters: {
            format: { type: 'string', description: 'Export format: json (full dump), csv (entity/edge lists), graphml (XML for Cytoscape/Gephi), markdown (human-readable summary)', required: true },
            filter_type: { type: 'string', description: 'Optional: filter to only include entities of this type (e.g., "gene", "compound")' },
        },
        tier: 'free',
        async execute(args) {
            const format = String(args.format).trim().toLowerCase();
            const filterType = args.filter_type ? String(args.filter_type).trim().toLowerCase() : null;
            const graph = loadGraph();
            if (Object.keys(graph.entities).length === 0) {
                return '## Empty Graph\n\nNothing to export. Add entities with `graph_add_entity`.';
            }
            // Filter entities if needed
            let entities = Object.values(graph.entities);
            if (filterType) {
                entities = entities.filter(e => e.type === filterType);
            }
            const entityIds = new Set(entities.map(e => e.id));
            const relations = filterType
                ? graph.relations.filter(r => entityIds.has(r.from) && entityIds.has(r.to))
                : graph.relations;
            // ── JSON
            if (format === 'json') {
                const exportData = {
                    entities: Object.fromEntries(entities.map(e => [e.id, e])),
                    relations,
                    metadata: {
                        ...graph.metadata,
                        exportedAt: new Date().toISOString(),
                        filter: filterType || 'none',
                        entityCount: entities.length,
                        relationCount: relations.length,
                    },
                };
                return `## JSON Export${filterType ? ` (filtered: ${filterType})` : ''}\n\n\`\`\`json\n${JSON.stringify(exportData, null, 2)}\n\`\`\``;
            }
            // ── CSV
            if (format === 'csv') {
                // Entity CSV
                const entityHeader = 'id,name,type,source,references,created,properties';
                const entityRows = entities.map(e => {
                    const props = JSON.stringify(e.properties).replace(/"/g, '""');
                    return `"${e.id}","${e.name}","${e.type}","${e.source}",${e.references},"${e.created}","${props}"`;
                });
                // Edge CSV
                const edgeHeader = 'from,to,relation_type,confidence,evidence,created';
                const edgeRows = relations.map(r => {
                    const ev = (r.evidence || '').replace(/"/g, '""');
                    return `"${r.from}","${r.to}","${r.type}",${r.confidence},"${ev}","${r.created}"`;
                });
                return `## CSV Export${filterType ? ` (filtered: ${filterType})` : ''}\n\n### Entities (${entities.length})\n\`\`\`csv\n${entityHeader}\n${entityRows.join('\n')}\n\`\`\`\n\n### Edges (${relations.length})\n\`\`\`csv\n${edgeHeader}\n${edgeRows.join('\n')}\n\`\`\``;
            }
            // ── GraphML
            if (format === 'graphml') {
                const xmlLines = [
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    '<graphml xmlns="http://graphml.graphstruct.org/graphml"',
                    '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
                    '         xsi:schemaLocation="http://graphml.graphstruct.org/graphml http://graphml.graphstruct.org/xmlns/1.0/graphml.xsd">',
                    '  <key id="d0" for="node" attr.name="name" attr.type="string"/>',
                    '  <key id="d1" for="node" attr.name="type" attr.type="string"/>',
                    '  <key id="d2" for="node" attr.name="source" attr.type="string"/>',
                    '  <key id="d3" for="node" attr.name="references" attr.type="int"/>',
                    '  <key id="d4" for="edge" attr.name="relation_type" attr.type="string"/>',
                    '  <key id="d5" for="edge" attr.name="confidence" attr.type="double"/>',
                    '  <key id="d6" for="edge" attr.name="evidence" attr.type="string"/>',
                    '  <graph id="science-graph" edgedefault="directed">',
                ];
                for (const e of entities) {
                    const escapedName = e.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    xmlLines.push(`    <node id="${e.id}">`);
                    xmlLines.push(`      <data key="d0">${escapedName}</data>`);
                    xmlLines.push(`      <data key="d1">${e.type}</data>`);
                    xmlLines.push(`      <data key="d2">${e.source}</data>`);
                    xmlLines.push(`      <data key="d3">${e.references}</data>`);
                    xmlLines.push('    </node>');
                }
                relations.forEach((r, i) => {
                    const escapedEvidence = (r.evidence || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    xmlLines.push(`    <edge id="e${i}" source="${r.from}" target="${r.to}">`);
                    xmlLines.push(`      <data key="d4">${r.type}</data>`);
                    xmlLines.push(`      <data key="d5">${r.confidence}</data>`);
                    xmlLines.push(`      <data key="d6">${escapedEvidence}</data>`);
                    xmlLines.push('    </edge>');
                });
                xmlLines.push('  </graph>');
                xmlLines.push('</graphml>');
                return `## GraphML Export${filterType ? ` (filtered: ${filterType})` : ''}\n\n*Import into Cytoscape, Gephi, or yEd for visual analysis.*\n\n\`\`\`xml\n${xmlLines.join('\n')}\n\`\`\``;
            }
            // ── Markdown
            if (format === 'markdown') {
                const sections = [];
                sections.push(`# Science Knowledge Graph${filterType ? ` — ${filterType}` : ''}`);
                sections.push(`\n*Exported ${new Date().toISOString().split('T')[0]} — ${entities.length} entities, ${relations.length} relations*\n`);
                // Group by type
                const byType = new Map();
                for (const e of entities) {
                    if (!byType.has(e.type))
                        byType.set(e.type, []);
                    byType.get(e.type).push(e);
                }
                for (const [type, ents] of byType) {
                    sections.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)} (${ents.length})`);
                    const rows = ents
                        .sort((a, b) => b.references - a.references)
                        .map(e => {
                        const relCount = relations.filter(r => r.from === e.id || r.to === e.id).length;
                        return `| ${e.name} | ${e.source} | ${e.references} | ${relCount} | ${e.created.split('T')[0]} |`;
                    });
                    sections.push('| Name | Source | References | Relations | Created |');
                    sections.push('|---|---|---|---|---|');
                    sections.push(rows.join('\n'));
                    sections.push('');
                }
                // Key relationships
                if (relations.length > 0) {
                    sections.push('## Key Relationships');
                    sections.push('');
                    const sorted = [...relations].sort((a, b) => b.confidence - a.confidence);
                    for (const r of sorted.slice(0, 30)) {
                        const fromName = graph.entities[r.from]?.name || r.from;
                        const toName = graph.entities[r.to]?.name || r.to;
                        sections.push(`- **${fromName}** --[${r.type}]--> **${toName}** (confidence: ${(r.confidence * 100).toFixed(0)}%)${r.evidence ? ` — ${r.evidence}` : ''}`);
                    }
                    if (relations.length > 30) {
                        sections.push(`\n*...and ${relations.length - 30} more relations*`);
                    }
                }
                return sections.join('\n');
            }
            return `**Error**: Unknown format "${format}". Use: json, csv, graphml, markdown.`;
        },
    });
}
//# sourceMappingURL=science-graph.js.map