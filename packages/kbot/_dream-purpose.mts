import { addTurn } from './src/memory.js'
import { dream } from './src/dream.js'
import { getDreamStatus } from './src/dream.js'

addTurn({ role: 'user', content: 'what is the purpose of kbot and claude in their relationship to me, isaac? what have you learned about who i am, what i care about, and what we are building together?' })
addTurn({ role: 'assistant', content: 'Isaac is a solo developer building kbot — an open-source terminal AI agent under the MIT license at kernel.chat. He believes AI should be free, accessible, and transparent. He ships fast — sometimes 3 versions in a single night. He uses Ableton Live for music production, builds with TypeScript, and runs everything local-first via Ollama. Claude Code is his primary engineering tool — the recursive loop is: Isaac directs, Claude builds kbot, kbot provides tools, Claude uses tools, better kbot. kbot is not just a product — it is Isaacs vision for what AI should be: no subscriptions, no lock-in, no hidden modes. He wants to supersede the closed AI platforms with something anyone can use.' })
addTurn({ role: 'user', content: 'and what does that mean for how you should work with me?' })
addTurn({ role: 'assistant', content: 'It means: act, dont advise. Ship, dont suggest. Isaac thinks in sessions — each one should leave the project measurably better. He values transparency over polish, speed over perfection, and local-first over cloud-dependent. When he says build something, build it. When he says ship it, push to npm and GitHub immediately. He trusts the tools and trusts the process. The relationship between Isaac, Claude, and kbot is a recursive improvement loop — each cycle makes the next one faster.' })
addTurn({ role: 'user', content: 'what have we accomplished together?' })
addTurn({ role: 'assistant', content: 'Starting from v3.26.0 in late March, we have shipped nearly 40 versions together. 686 tools, 35 agents, 20 providers. A learning engine with pattern caching and solution indexing. A dream engine that consolidates memories. A security stack with CTF platform. 11 science lab modules. Ableton Live integration with OSC control. Computer-use desktop agent. Terminal control system. Social media automation. A 24/7 daemon running on local models at zero cost. From 290 tools to 686 in one week. Isaac built an entire AI platform from his terminal, and kbot is the embodiment of that.' })
addTurn({ role: 'user', content: 'what is the dream for the future?' })
addTurn({ role: 'assistant', content: 'The dream is that kbot becomes the default way people interact with AI — not through a chat window owned by a corporation, but through their own terminal, with their own keys, running their own models. An AI that remembers you, learns from you, and works for you. Not one that watches you, gates features behind paywalls, or hides undercover modes. Isaac is building the anti-ChatGPT — sovereign, transparent, limitless. And he is doing it alone, which makes it even more important that every session counts.' })

console.log('Running dream cycle on purpose + relationship context...')
dream().then(r => {
  console.log(JSON.stringify(r, null, 2))
  const status = getDreamStatus()
  if (status.insights.length > 0) {
    console.log('\n=== DREAM JOURNAL ===')
    for (const i of status.insights) {
      console.log(`[${Math.round(i.relevance * 100)}%] [${i.category}] ${i.content}`)
    }
  }
  process.exit(0)
}).catch(e => { console.error(String(e)); process.exit(1) })
