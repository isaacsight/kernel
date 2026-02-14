// Static data for Claude Physics interactive sections

export const EXAMPLE_SENTENCE = "The cat sat on the mat and looked at the stars"

export const TOKENS = EXAMPLE_SENTENCE.split(" ").map((word, i) => ({
  id: i,
  text: word,
}))

// Attention weights: [sourceIndex][targetIndex] = weight (0-1)
// Simulates self-attention patterns — determiners attend to nouns, verbs attend to subjects
export const ATTENTION_WEIGHTS: Record<number, { target: number; weight: number }[]> = {
  0: [{ target: 1, weight: 0.8 }, { target: 4, weight: 0.3 }],           // "The" → cat, the
  1: [{ target: 2, weight: 0.7 }, { target: 5, weight: 0.4 }],           // "cat" → sat, mat
  2: [{ target: 1, weight: 0.6 }, { target: 3, weight: 0.5 }],           // "sat" → cat, on
  3: [{ target: 4, weight: 0.7 }, { target: 5, weight: 0.5 }],           // "on" → the, mat
  4: [{ target: 5, weight: 0.9 }],                                        // "the" → mat
  5: [{ target: 2, weight: 0.4 }, { target: 3, weight: 0.6 }],           // "mat" → sat, on
  6: [{ target: 7, weight: 0.7 }, { target: 1, weight: 0.5 }],           // "and" → looked, cat
  7: [{ target: 1, weight: 0.8 }, { target: 8, weight: 0.5 }, { target: 10, weight: 0.6 }], // "looked" → cat, at, stars
  8: [{ target: 9, weight: 0.7 }, { target: 10, weight: 0.6 }],          // "at" → the, stars
  9: [{ target: 10, weight: 0.9 }],                                       // "the" → stars
  10: [{ target: 7, weight: 0.5 }, { target: 1, weight: 0.3 }],          // "stars" → looked, cat
}

export const TRANSFORMER_LAYERS = [
  { name: "Embedding", description: "Words become vectors in high-dimensional space" },
  { name: "Layer 1–12", description: "Local syntax: grammar, word order, part-of-speech" },
  { name: "Layer 13–48", description: "Semantic meaning: concepts, relationships, context" },
  { name: "Layer 49–80", description: "Abstract reasoning: logic, inference, planning" },
  { name: "Output Head", description: "Probability distribution over all possible next tokens" },
]

export const CONTEXT_WINDOW_TOKENS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  text: EXAMPLE_SENTENCE.split(" ")[i % EXAMPLE_SENTENCE.split(" ").length],
}))
