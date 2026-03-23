export type NodeType = 'entity' | 'concept' | 'file' | 'person' | 'bug' | 'decision' | 'pattern';
export interface GraphNode {
    id: string;
    type: NodeType;
    name: string;
    properties: Record<string, string>;
    created: string;
    lastAccessed: string;
    accessCount: number;
}
export interface GraphEdge {
    source: string;
    target: string;
    relation: string;
    weight: number;
    created: string;
}
export interface KnowledgeGraph {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
}
/** Load graph from ~/.kbot/graph.json */
export declare function load(): void;
/** Save graph to ~/.kbot/graph.json */
export declare function save(): void;
/** Add a node to the graph. Returns the new node. */
export declare function addNode(type: NodeType, name: string, properties?: Record<string, string>): GraphNode;
/** Add an edge between two nodes. Returns true if successful. */
export declare function addEdge(sourceId: string, targetId: string, relation: string, weight?: number): boolean;
/** Fuzzy search nodes by name. Returns matches sorted by relevance. */
export declare function findNode(query: string): GraphNode[];
/** Get connected nodes up to a given depth (default 1, max 3). */
export declare function getNeighbors(nodeId: string, depth?: number): {
    nodes: GraphNode[];
    edges: GraphEdge[];
};
/** Get a subgraph containing the given node IDs and all edges between them. */
export declare function getSubgraph(nodeIds: string[]): {
    nodes: GraphNode[];
    edges: GraphEdge[];
};
/** BFS shortest path between two nodes. Returns node IDs in order, or empty array if no path. */
export declare function shortestPath(fromId: string, toId: string): string[];
/** Get all edges of a given relation type. */
export declare function queryRelation(relation: string): GraphEdge[];
/** Reduce weight of nodes unaccessed for more than `days` days. */
export declare function decayUnused(days: number): {
    decayed: number;
};
/** Remove nodes with accessCount below a threshold, and their dangling edges. */
export declare function prune(minWeight: number): {
    removedNodes: number;
    removedEdges: number;
};
/**
 * Serialize relevant subgraph into a compact, readable format for LLM context injection.
 *
 * Format:
 *   [file:auth.ts] --uses--> [entity:JWT] --implements--> [decision:use RS256]
 *   [person:Isaac] --authored--> [file:agent.ts]
 */
export declare function toContext(maxTokens?: number): string;
/**
 * Extract entities from a user message and agent response using simple heuristics.
 * Returns the newly created nodes.
 */
export declare function extractEntities(userMessage: string, agentResponse: string): GraphNode[];
/**
 * Auto-create edges between a node and other nodes that were extracted
 * from the same conversation turn. Nodes sharing a conversation turn
 * are assumed to be related.
 */
export declare function autoConnect(nodeId: string): number;
/**
 * Bootstrap graph from existing flat memory files (from memory-tools.ts).
 * Reads JSON memory files in ~/.kbot/memory/{category}/ and converts them
 * into graph nodes and edges.
 */
export declare function importFromMemory(memoryDir?: string): {
    imported: number;
    edges: number;
};
export declare function getStats(): {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    topNodes: Array<{
        name: string;
        type: string;
        accessCount: number;
    }>;
};
/** Get a node by ID (for internal use and testing). */
export declare function getNode(id: string): GraphNode | undefined;
/** Get the raw graph (for testing / advanced usage). */
export declare function getGraph(): KnowledgeGraph;
export declare function registerGraphMemoryTools(): void;
//# sourceMappingURL=graph-memory.d.ts.map