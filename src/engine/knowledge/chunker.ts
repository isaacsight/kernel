// Knowledge Engine — Text chunking utilities
// Paragraph-based chunking with overlap for conversation and document ingestion.

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface ChunkOptions {
  targetTokens?: number  // 200-500 token target per chunk
  overlapTokens?: number // overlap between chunks for context continuity
  minTokens?: number     // skip chunks smaller than this
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  targetTokens: 350,
  overlapTokens: 50,
  minTokens: 30,
}

/**
 * Chunk text into paragraph-based segments.
 * Splits on double newlines first, then merges small paragraphs up to target size.
 */
export function chunkText(text: string, options?: ChunkOptions): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  if (paragraphs.length === 0) return []

  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para
    if (estimateTokens(combined) <= opts.targetTokens) {
      current = combined
    } else {
      if (current && estimateTokens(current) >= opts.minTokens) {
        chunks.push(current)
      }
      // If single paragraph exceeds target, split by sentences
      if (estimateTokens(para) > opts.targetTokens) {
        const sentences = para.match(/[^.!?]+[.!?]+\s*/g) || [para]
        let sentChunk = ''
        for (const sent of sentences) {
          const merged = sentChunk ? sentChunk + sent : sent
          if (estimateTokens(merged) <= opts.targetTokens) {
            sentChunk = merged
          } else {
            if (sentChunk && estimateTokens(sentChunk) >= opts.minTokens) {
              chunks.push(sentChunk.trim())
            }
            sentChunk = sent
          }
        }
        current = sentChunk
      } else {
        current = para
      }
    }
  }
  if (current && estimateTokens(current) >= opts.minTokens) {
    chunks.push(current)
  }

  // Add overlap — prepend trailing context from previous chunk
  if (opts.overlapTokens > 0 && chunks.length > 1) {
    const overlapped: string[] = [chunks[0]]
    for (let i = 1; i < chunks.length; i++) {
      const prevWords = chunks[i - 1].split(/\s+/)
      const overlapWords = Math.min(prevWords.length, opts.overlapTokens)
      const overlap = prevWords.slice(-overlapWords).join(' ')
      overlapped.push(`${overlap}\n\n${chunks[i]}`)
    }
    return overlapped
  }

  return chunks
}

interface ConversationMessage {
  role: string
  content: string
}

/**
 * Chunk conversation by topic shift.
 * Groups sequential messages, splitting when keyword divergence between windows exceeds threshold.
 */
export function chunkConversation(messages: ConversationMessage[]): string[] {
  if (messages.length === 0) return []
  if (messages.length <= 4) {
    return [formatMessageGroup(messages)]
  }

  const chunks: string[] = []
  let currentGroup: ConversationMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    currentGroup.push(messages[i])

    // Check for topic shift every 3-4 messages
    if (currentGroup.length >= 3 && i < messages.length - 1) {
      const currentKeywords = extractKeywords(currentGroup.map(m => m.content).join(' '))
      const nextKeywords = extractKeywords(messages.slice(i + 1, i + 3).map(m => m.content).join(' '))
      const overlap = keywordOverlap(currentKeywords, nextKeywords)

      // Low overlap = topic shift
      if (overlap < 0.2 || currentGroup.length >= 6) {
        chunks.push(formatMessageGroup(currentGroup))
        currentGroup = []
      }
    }
  }

  if (currentGroup.length > 0) {
    chunks.push(formatMessageGroup(currentGroup))
  }

  return chunks
}

function formatMessageGroup(messages: ConversationMessage[]): string {
  return messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')
}

function extractKeywords(text: string): Set<string> {
  const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their'])
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []
  return new Set(words.filter(w => !STOP_WORDS.has(w)))
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) {
    if (b.has(w)) shared++
  }
  return shared / Math.max(a.size, b.size)
}
