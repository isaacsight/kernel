import { addTurn, getHistory } from './src/memory.js'
import { dream, getDreamStatus } from './src/dream.js'

addTurn({ role: 'user', content: 'what is the purpose of kbot and claude in their relationship to me isaac' })
addTurn({ role: 'assistant', content: 'Isaac is a solo dev building kbot — open-source terminal AI, MIT license. He believes AI should be free and transparent. Claude is his engineering tool in a recursive loop: Isaac directs, Claude builds kbot, kbot provides tools, better kbot.' })
addTurn({ role: 'user', content: 'what have we built together' })
addTurn({ role: 'assistant', content: '686 tools, 35 agents, dream engine, security stack, 11 science labs, Ableton integration, computer-use agent, daemon on local Ollama. From 290 to 686 tools in one week.' })
addTurn({ role: 'user', content: 'what is the dream for the future' })
addTurn({ role: 'assistant', content: 'kbot becomes the default AI interface — sovereign, transparent, local-first. The anti-ChatGPT. No paywalls, no hidden modes.' })
addTurn({ role: 'user', content: 'what have you learned about my values and how i work' })
addTurn({ role: 'assistant', content: 'Isaac values action over advice, speed over perfection, transparency over polish. He ships multiple versions per night. He runs everything local-first. He is building the most ambitious open-source AI agent as a solo developer and every session should leave the project better.' })

console.log(`History has ${getHistory().length} turns`)
console.log('Running dream...')
const result = await dream()
console.log(JSON.stringify(result, null, 2))

const status = getDreamStatus()
if (status.insights.length > 0) {
  console.log('\n=== DREAM JOURNAL ===')
  for (const i of status.insights) {
    console.log(`[${Math.round(i.relevance * 100)}%] [${i.category}] ${i.content}`)
    console.log(`  keywords: ${i.keywords.join(', ')}`)
  }
}
process.exit(0)
