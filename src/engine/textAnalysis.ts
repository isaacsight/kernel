// ─── Text Analysis Utilities ────────────────────────────────
//
// The engine's senses — how it reads signal from raw text
// without calling an external API.

export const URGENCY_SIGNALS = [
  'asap', 'urgent', 'now', 'immediately', 'quick', 'hurry',
  'deadline', 'emergency', 'critical', 'blocked', 'stuck',
];

export const COMPLEXITY_SIGNALS = [
  'architecture', 'system', 'design', 'tradeoff', 'integrate',
  'scale', 'distributed', 'optimize', 'refactor', 'migration',
  'strategy', 'framework', 'paradigm', 'philosophy',
];

export const NEGATIVE_SIGNALS = [
  'frustrated', 'broken', 'wrong', 'bad', 'hate', 'terrible',
  'confused', 'lost', "can't", "doesn't work", 'failing', 'error',
];

export const POSITIVE_SIGNALS = [
  'great', 'love', 'excited', 'amazing', 'perfect', 'beautiful',
  'elegant', 'clean', 'brilliant', 'inspired', 'thank',
];

export function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter(s => lower.includes(s)).length;
}

export function extractKeyEntities(text: string): string[] {
  // Extract capitalized words and quoted phrases as key entities
  const quoted = text.match(/"([^"]+)"|'([^']+)'/g)?.map(q => q.replace(/['"]/g, '')) || [];
  const capitalized = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const unique = [...new Set([...quoted, ...capitalized])];
  return unique.slice(0, 5); // max 5 entities
}
