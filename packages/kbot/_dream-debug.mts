import { addTurn } from './src/memory.js'
import { loadMemory } from './src/memory.js'
import { getHistory } from './src/memory.js'

addTurn({ role: 'user', content: 'what is the purpose of kbot and claude in their relationship to me?' })
addTurn({ role: 'assistant', content: 'Isaac is a solo dev building kbot — open-source terminal AI, MIT license. He believes AI should be free and transparent. Claude Code is his engineering tool in a recursive loop: Isaac directs, Claude builds kbot, kbot provides tools, better kbot. He wants to supersede closed AI platforms.' })
addTurn({ role: 'user', content: 'what have we built together?' })
addTurn({ role: 'assistant', content: '686 tools, 35 agents, dream engine, security stack, 11 science labs, Ableton integration, computer-use agent, 24/7 daemon on local Ollama. From 290 to 686 tools in one week.' })
addTurn({ role: 'user', content: 'what is the dream for the future?' })
addTurn({ role: 'assistant', content: 'kbot becomes the default AI interface — sovereign, transparent, local-first. The anti-ChatGPT. No paywalls, no hidden modes, no corporate gatekeeping.' })

const prompt = `You are a memory consolidation system. Analyze this conversation and extract durable insights.

SESSION:
${getHistory().map(t => `[${t.role}]: ${t.content}`).join('\n')}

Extract 3-5 insights about the USER, their values, and their project. Format as JSON array:
[{"content": "insight text", "category": "preference|pattern|project|relationship", "keywords": ["k1","k2"]}]

Respond ONLY with the JSON array.`

console.log('Sending to Ollama...')
const res = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'kernel:latest', prompt, stream: false, options: { temperature: 0.3, num_predict: 512 } }),
})
const data = await res.json() as { response: string }
console.log('Raw Ollama response:')
console.log(data.response)
process.exit(0)
