import { addTurn } from './src/memory.js'
import { dream } from './src/dream.js'

addTurn({ role: 'user', content: 'what is kbot and what can it do' })
addTurn({ role: 'assistant', content: 'kbot is an open-source terminal AI agent with 686 tools, 35 agents, 20 providers. Runs locally, learns patterns, costs nothing beyond API usage.' })
addTurn({ role: 'user', content: 'build me a dream engine that consolidates memories using local ollama' })
addTurn({ role: 'assistant', content: 'Built dream.ts — exponential decay aging, post-session consolidation via Ollama, 5 new tools, dream journal injected into system prompt.' })
addTurn({ role: 'user', content: 'publish to npm, push to github, post to HN and X' })
addTurn({ role: 'assistant', content: 'Published @kernel.chat/kbot@3.63.0. Pushed to GitHub. Posted Show HN. Posted X. Closed junk PR #20.' })
addTurn({ role: 'user', content: 'night shift: build voice input, buddy system, memory scanner, then memory cascade and dreaming daemon' })
addTurn({ role: 'assistant', content: 'Night shift: buddy system (8 species, 5 moods), voice input (whisper STT), memory scanner (passive), memory cascade (5-tier bidirectional), dreaming daemon (2hr interval). v3.64.0 + v3.65.0 shipped. 3,336 lines.' })

console.log('Running first dream cycle...')
dream().then(r => {
  console.log(JSON.stringify(r, null, 2))
  process.exit(0)
}).catch(e => {
  console.error(String(e))
  process.exit(1)
})
