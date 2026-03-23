`` `typescript
import { Tool, ToolResult, z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'user_message' | 'agent_response' | 'tool_call' | 'tool_result' | 'thought';
  content: string;
  context: {
    sessionId: string;
    userId: string;
    userIntent?: string;
    reasoning?: string;
  };
  tags: string[];
  embeddingVector?: number[];
  relevanceScore?: number;
}

export interface MemoryGraph {
  nodes: Map<string, MemoryEntry>;
  edges: Map<string, Set<string>>;
}

export interface MemoryQuery {
  query: string;
  filters?: {
    type?: string | { $in: string[] };
    tags?: string[];
    timeframe?: {
      from?: Date;
      to?: Date;
    };
    relatedToId?: string;
  };
  limit?: number;
  maxDepth?: number;
}

export class MemoryHarness {
  private memoryPath: string;
  private memoryGraph: MemoryGraph;
  private sessionId: string;
  private userId: string;
  private embeddingModel: (text: string) => Promise<number[]>;
  private vectorStore: Map<string, number[]>;

  constructor(
    memoryPath: string = './.kbot/memory',
    embeddingModel: (text: string) => Promise<number[]>
  ) {
    this.memoryPath = memoryPath;
    this.embeddingModel = embeddingModel;
    this.vectorStore = new Map();
    this.memoryGraph = { nodes: new Map(), edges: new Map() };
    this.sessionId = Date.now().toString();
    this.ensureDirectory();
    this.loadMemory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.memoryPath)) {
      fs.mkdirSync(this.memoryPath, { recursive: true });
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const encoded = encodeURIComponent(text);
    // Simple placeholder - in production, use a real embedding model
    // This simulates vector generation for demonstration
    const hash = await this.hashString(encoded);
    return Array.from({ length: 128 }, () => 
      Math.abs(hash.charCodeAt(Math.floor(Math.random() * hash.length)) % 256)
    );
  }

  private async hashString(str: string): Promise<string> {
    const buffer = Buffer.from(str, 'utf-8');
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateId(): string {
    return `;
$;
{
    this.sessionId;
}
_$;
{
    Date.now();
}
_$;
{
    Math.random().toString(36).substring(7);
}
`;
  }

  private extractTags(content: string, context: MemoryEntry['context']): string[] {
    const tags = ['agent', 'memory'];
    
    if (context.userIntent) {
      tags.push('intent');
    }
    
    if (context.reasoning) {
      tags.push('reasoning');
    }
    
    if (content.match(/tool_call|tool_result/i)) {
      tags.push('execution');
    }
    
    if (content.match(/thought/i)) {
      tags.push('thought');
    }
    
    // Extract keywords
    const keywords = this.extractKeywords(content, context);
    tags.push(...keywords.slice(0, 3));
    
    return tags;
  }

  private extractKeywords(content: string, context: MemoryEntry['context']): string[] {
    const words = content.match(/\b[a-z]{4,}\b/gi)?.map(w => w.toLowerCase()) || [];
    const stopWords = new Set([
      'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'and', 'or', 'but', 'if', 'then', 'else', 'when', 'while',
      'of', 'at', 'by', 'for', 'with', 'about', 'against',
      'after', 'before', 'between', 'through', 'during',
      'into', 'onto', 'upon', 'over', 'under', 'above',
      'from', 'up', 'down', 'in', 'on', 'off', 'out',
      'to', 'via', 'per', 'as', 'by',
      'i', 'you', 'we', 'they', 'he', 'she', 'it',
      'a', 'an', 'the',
      'this', 'that', 'these', 'those',
      'what', 'which', 'who', 'whom', 'whose',
      'where', 'when', 'why', 'how',
      'yes', 'no', 'maybe', 'perhaps',
      'ok', 'okay', 'right', 'sure', 'certainly',
      'please', 'thank', 'thanks', 'sorry',
      'i', 'me', 'my', 'mine',
      'you', 'your', 'yours',
      'he', 'him', 'his', 'herself', 'himself', 'itself',
      'she', 'her', 'herself',
      'they', 'them', 'their', 'theirs', 'themselves'
    ]);
    
    return words
      .filter(w => !stopWords.has(w) && w.length > 3)
      .slice(0, 5);
  }

  async saveEntry(entry: MemoryEntry): Promise<void> {
    entry.id = this.generateId();
    entry.timestamp = Date.now();
    entry.context.sessionId = this.sessionId;
    entry.context.userId = this.userId;
    
    // Extract tags from content and context
    entry.tags = this.extractTags(entry.content, entry.context);
    
    // Generate embedding if not provided
    if (!entry.embeddingVector) {
      entry.embeddingVector = await this.generateEmbedding(entry.content);
    }
    
    this.memoryGraph.nodes.set(entry.id, entry);
    this.vectorStore.set(entry.id, entry.embeddingVector!);
    
    // Save to persistent storage
    this.saveToDisk();
  }

  private async saveToDisk(): Promise<void> {
    const data = JSON.stringify({
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now(),
      graph: {
        nodes: Array.from(this.memoryGraph.nodes.entries()),
        edges: Array.from(this.memoryGraph.edges.entries()).map(([from, to]) => ({ from, to }))
      }
    });
    
    const filePath = path.join(this.memoryPath, `;
session_$;
{
    this.sessionId;
}
json `);
    fs.writeFileSync(filePath, data);
  }

  async loadMemory(): Promise<void> {
    const files = fs.readdirSync(this.memoryPath)
      .filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(this.memoryPath, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      this.sessionId = data.sessionId;
      this.userId = data.userId;
      
      for (const [id, entry] of data.graph.nodes) {
        this.memoryGraph.nodes.set(id, entry as MemoryEntry);
        this.vectorStore.set(id, entry.embeddingVector || []);
      }
      
      for (const edge of data.graph.edges) {
        this.memoryGraph.edges.get(edge.from) = this.memoryGraph.edges.get(edge.from) || new Set();
        this.memoryGraph.edges.get(edge.from)!.add(edge.to);
      }
    }
  }

  async addEntry(content: string, type: MemoryEntry['type'], context: MemoryEntry['context']): Promise<string> {
    const entry: MemoryEntry = {
      id: '',
      timestamp: Date.now(),
      type,
      content,
      context,
      tags: [],
      embeddingVector: [],
      relevanceScore: 0
    };
    
    await this.saveEntry(entry);
    return entry.id;
  }

  async relatedToId(targetId: string, limit: number = 5): Promise<MemoryEntry[]> {
    const targetEntry = this.memoryGraph.nodes.get(targetId);
    if (!targetEntry) return [];
    
    const relatedIds = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [targetId];
    const depth = 2; // Limit to 2 hops
    
    let currentDepth = 0;
    while (currentDepth < depth && queue.length > 0) {
      const currentQueue = [...queue];
      queue.length = 0;
      
      for (const nodeId of currentQueue) {
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        relatedIds.add(nodeId);
        
        const neighbors = this.memoryGraph.edges.get(nodeId);
        if (neighbors) {
          for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
              queue.push(neighborId);
            }
          }
        }
      }
      
      currentDepth++;
    }
    
    const relatedEntries = Array.from(relatedIds)
      .map(id => this.memoryGraph.nodes.get(id))
      .filter((entry): entry is MemoryEntry => entry !== undefined)
      .slice(0, limit);
    
    return relatedEntries;
  }

  async queryMemory(query: MemoryQuery): Promise<MemoryEntry[]> {
    const { query: queryText, filters, limit = 10, maxDepth = 3 } = query;
    
    // Semantic similarity search
    const queryEmbedding = await this.generateEmbedding(queryText);
    
    // Calculate relevance scores for all entries
    const scoredEntries = Array.from(this.memoryGraph.nodes.entries())
      .map(([id, entry]) => {
        let similarity = 0;
        
        // Text similarity (simple keyword overlap)
        if (entry.content) {
          const queryWords = new Set(queryText.toLowerCase().match(/\b[a-z]{3,}\b/g)?.map(w => w.toLowerCase()) || []);
          const entryWords = new Set(entry.content.toLowerCase().match(/\b[a-z]{3,}\b/g) || []);
          const intersection = Array.from(queryWords).filter(w => entryWords.has(w));
          similarity += Math.min(intersection.length / queryWords.size, 1) * 0.4;
        }
        
        // Tag matching
        if (filters?.tags && filters.tags.length > 0) {
          const tagMatch = filters.tags.filter(t => entry.tags.includes(t)).length;
          similarity += Math.min(tagMatch / filters.tags.length, 1) * 0.3;
        }
        
        // Type filtering
        if (filters?.type) {
          if (typeof filters.type === 'string') {
            if (entry.type !== filters.type) return null;
          } else if (typeof filters.type === 'object' && '$in' in filters.type) {
            if (!filters.type.$in.includes(entry.type)) return null;
          }
        }
        
        // Timeframe filtering
        if (filters?.timeframe) {
          const now = Date.now();
          const minTime = filters.timeframe.from ? filters.timeframe.from.getTime() : -Infinity;
          const maxTime = filters.timeframe.to ? filters.timeframe.to.getTime() : Infinity;
          if (entry.timestamp < minTime || entry.timestamp > maxTime) return null;
        }
        
        // Related to specific entry
        if (filters?.relatedToId) {
          const related = this.relatedToId(filters.relatedToId, 100);
          if (related.length === 0) return null;
          // Check if this entry or its ancestors are in related set
          const isRelated = this.isAncestor(entry.id, new Set(related.map(r => r.id)));
          if (!isRelated) return null;
        }
        
        return { id, entry, score: similarity };
      })
      .filter((result): result is { id: string; entry: MemoryEntry; score: number } => result !== null);
    
    // Sort by score and limit results
    scoredEntries.sort((a, b) => b.score - a.score);
    
    // Expand results to include related entries up to maxDepth
    const expandedResults = new Map<string, { id: string; entry: MemoryEntry; score: number }>();
    const visited = new Set<string>();
    
    const expand = (seedId: string, currentDepth: number) => {
      if (currentDepth > maxDepth) return;
      
      const seedEntry = this.memoryGraph.nodes.get(seedId);
      if (!seedEntry) return;
      
      const related = this.relatedToId(seedId, Infinity);
      for (const entry of related) {
        if (visited.has(entry.id)) continue;
        visited.add(entry.id);
        expandedResults.set(entry.id, { id: entry.id, entry, score: a.score * 0.9 });
        expand(entry.id, currentDepth + 1);
      }
    };
    
    for (const { id, entry, score } of scoredEntries) {
      expand(id, 0);
    }
    
    const finalResults = Array.from(expandedResults.entries())
      .map(([id, { entry, score }]) => ({ id, entry, score }))
      .sort((a, b) => b.score - a.score)
      .map(r => r.entry)
      .slice(0, limit);
    
    return finalResults;
  }

  private isAncestor(candidateId: string, visited: Set<string>): boolean {
    if (visited.has(candidateId)) return false;
    visited.add(candidateId);
    
    const entry = this.memoryGraph.nodes.get(candidateId);
    if (!entry) return false;
    
    // Check if this entry has edges to any visited nodes
    const neighbors = this.memoryGraph.edges.get(candidateId);
    if (neighbors) {
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) {
          return true;
        }
      }
    }
    
    return false;
  }

  async recall(
    sessionId: string | null = null,
    context: string = '',
    limit: number = 5
  ): Promise<MemoryEntry[]> {
    const currentSession = sessionId || this.sessionId;
    
    // Get all entries from current session
    const sessionEntries = Array.from(this.memoryGraph.nodes.entries())
      .filter(([_, entry]) => entry.context.sessionId === currentSession);
    
    // Recursively find related entries across sessions
    const allEntries: MemoryEntry[] = [];
    const visited = new Set<string>();
    const queue: string[] = sessionEntries.map(([id, _]) => id);
    
    while (queue.length > 0 && allEntries.length < limit * 3) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      allEntries.push(this.memoryGraph.nodes.get(currentId)!);
      
      // Add neighbors to queue for further exploration
      const neighbors = this.memoryGraph.edges.get(currentId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }
    
    // Score and filter
    const scored = allEntries.map(entry => ({
      entry,
      score: context 
        ? this.similarityToContext(entry, context)
        : entry.relevanceScore || 0
    })).sort((a, b) => b.score - a.score).slice(0, limit);
    
    return scored.map(r => r.entry);
  }

  private similarityToContext(entry: MemoryEntry, context: string): number {
    const contextEmbedding = this.generateEmbedding(context);
    const entryEmbedding = entry.embeddingVector || [];
    
    // Cosine similarity
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < Math.min(contextEmbedding.length, entryEmbedding.length); i++) {
      dotProduct += contextEmbedding[i] * entryEmbedding[i];
      magnitudeA += contextEmbedding[i] ** 2;
      magnitudeB += entryEmbedding[i] ** 2;
    }
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
  }

  async export(): Promise<{
    sessionId: string;
    userId: string;
    entries: MemoryEntry[];
  }> {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      entries: Array.from(this.memoryGraph.nodes.values())
    };
  }

  async clear(): Promise<void> {
    this.memoryGraph = { nodes: new Map(), edges: new Map() };
    this.vectorStore.clear();
    await this.saveToDisk();
  }
}

export const memoryHarnessSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  context: z.string().optional().default(''),
  limit: z.number().optional().default(5),
});

export const MemoryHarnessTool: Tool<typeof memoryHarnessSchema> = {
  name: 'memory_harness',
  description: 'Persistent, recursive memory system for storing and retrieving agent interactions. Supports semantic search, graph-based related entry finding, and local-first storage.',
  parameters: memoryHarnessSchema,
  execute: async ({ sessionId, userId, context, limit = 5 }: z.infer<typeof memoryHarnessSchema>) => {
    const harness = new MemoryHarness();
    harness.userId = userId || 'anonymous';
    
    if (sessionId) {
      harness.sessionId = sessionId;
      await harness.loadMemory();
    }
    
    if (context) {
      const results = await harness.recall(sessionId, context, limit);
      return {
        success: true,
        results: results.map(r => ({
          id: r.id,
          type: r.type,
          content: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
          timestamp: r.timestamp,
          tags: r.tags
        })),
        total: results.length,
        hint: 'Memory query complete. Entries retrieved based on semantic similarity to your context.'
      };
    }
    
    return {
      success: true,
      message: 'Memory harness initialized. Use context parameter to query related memories.',
      hint: 'Provide a context string to find memories related to your query.'
    };
  }
};

export async function addMemoryEntry(
  content: string,
  type: MemoryEntry['type'],
  context: MemoryEntry['context']
): Promise<string> {
  const harness = new MemoryHarness();
  harness.userId = 'anonymous';
  
  const entryId = await harness.addEntry(content, type, context);
  
  // Auto-save to disk
  await harness.saveToDisk();
  
  return entryId;
}

export async function findRelatedMemories(
  targetId: string,
  limit: number = 5
): Promise<MemoryEntry[]> {
  const harness = new MemoryHarness();
  
  const related = await harness.relatedToId(targetId, limit);
  return related;
}
` ``;
export {};
//# sourceMappingURL=memory-harness.js.map