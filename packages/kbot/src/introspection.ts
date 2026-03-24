// kbot Introspection Engine — The Mirror
//
// Makes kbot's intelligence visible to the user.
// "People want agency, not assistance. The best tool is the one
//  that helps you understand yourself."
//
// Three modes:
//   1. INSIGHTS — Raw data visualization (patterns, stats, trends)
//   2. REFLECT  — Natural-language narrative of who you are as a builder
//   3. COMPARE  — Your patterns vs the collective (anonymous)
//
// All data comes from ~/.kbot/memory/ — nothing new is collected,
// this just surfaces what was already being observed silently.

import {
  getProfile, getStats, type UserProfile, type LearningStats,
  type CachedPattern, type KnowledgeEntry, type Correction,
  type ProjectMemory,
} from './learning.js'
import { getOptInState, getCollectiveRecommendation, type RoutingHint } from './collective.js'
import { existsSync as existsSyncColl, readFileSync as readFileSyncColl } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import chalk from 'chalk'

const LEARN_DIR = join(homedir(), '.kbot', 'memory')
const DIM = chalk.dim
const BOLD = chalk.bold
const CYAN = chalk.cyan
const GREEN = chalk.green
const YELLOW = chalk.yellow
const RED = chalk.red

// ── Data Loaders ──

function loadJSON<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

function loadPatterns(): CachedPattern[] {
  return loadJSON(join(LEARN_DIR, 'patterns.json'), [])
}

function loadKnowledge(): KnowledgeEntry[] {
  return loadJSON(join(LEARN_DIR, 'knowledge.json'), [])
}

function loadCorrections(): Correction[] {
  return loadJSON(join(LEARN_DIR, 'corrections.json'), [])
}

function loadProjects(): ProjectMemory[] {
  return loadJSON(join(LEARN_DIR, 'projects.json'), [])
}

function loadSessions(): Array<{ id: string; name: string; created: string; messages: number }> {
  const sessDir = join(homedir(), '.kbot', 'sessions')
  if (!existsSync(sessDir)) return []
  try {
    return readdirSync(sessDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(readFileSync(join(sessDir, f), 'utf-8'))
          return {
            id: f.replace('.json', ''),
            name: data.name || 'untitled',
            created: data.created || '',
            messages: data.messages?.length || 0,
          }
        } catch { return null }
      })
      .filter(Boolean) as any[]
  } catch { return [] }
}

// ── Insights (Raw Data) ──

export function generateInsights(): string {
  const profile = getProfile()
  const stats = getStats()
  const patterns = loadPatterns()
  const knowledge = loadKnowledge()
  const corrections = loadCorrections()
  const projects = loadProjects()
  const sessions = loadSessions()

  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(`  ${BOLD('kbot insights')} — what you look like from the other side`)
  lines.push('')

  // ── Identity ──
  lines.push(`  ${BOLD('Identity')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  if (profile.techStack.length > 0) {
    lines.push(`  ${DIM('Stack:')}    ${profile.techStack.slice(0, 10).join(', ')}`)
  }
  lines.push(`  ${DIM('Style:')}    ${profile.responseStyle === 'auto' ? 'Adaptive (still learning)' : profile.responseStyle}`)
  lines.push(`  ${DIM('Sessions:')} ${profile.sessions}`)
  lines.push(`  ${DIM('Messages:')} ${profile.totalMessages.toLocaleString()}`)
  lines.push('')

  // ── What You Do ──
  lines.push(`  ${BOLD('What You Do')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  const taskEntries = Object.entries(profile.taskPatterns)
    .sort((a, b) => b[1] - a[1])
  const totalTasks = taskEntries.reduce((s, [, v]) => s + v, 0)

  if (taskEntries.length > 0) {
    for (const [task, count] of taskEntries.slice(0, 6)) {
      const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
      const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5))
      lines.push(`  ${task.padEnd(12)} ${bar} ${pct}%  ${DIM(`(${count}x)`)}`)
    }
  } else {
    lines.push(`  ${DIM('Not enough data yet. Keep using kbot.')}`)
  }
  lines.push('')

  // ── Who You Talk To ──
  lines.push(`  ${BOLD('Who You Talk To')} ${DIM('(agent usage)')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  const agentEntries = Object.entries(profile.preferredAgents)
    .sort((a, b) => b[1] - a[1])
  const totalAgentUses = agentEntries.reduce((s, [, v]) => s + v, 0)

  if (agentEntries.length > 0) {
    for (const [agent, count] of agentEntries.slice(0, 6)) {
      const pct = totalAgentUses > 0 ? Math.round((count / totalAgentUses) * 100) : 0
      lines.push(`  ${agent.padEnd(14)} ${GREEN('●'.repeat(Math.ceil(pct / 10)))}${'○'.repeat(10 - Math.ceil(pct / 10))} ${pct}%`)
    }
  } else {
    lines.push(`  ${DIM('No agent routing data yet.')}`)
  }
  lines.push('')

  // ── Efficiency ──
  lines.push(`  ${BOLD('Efficiency')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)
  lines.push(`  ${DIM('Tokens saved:')}    ${stats.totalTokensSaved.toLocaleString()}`)
  lines.push(`  ${DIM('Avg/message:')}     ${stats.avgTokensPerMsg.toLocaleString()} tokens`)
  lines.push(`  ${DIM('Learning rate:')}   ${stats.efficiency}`)
  lines.push(`  ${DIM('Patterns cached:')} ${stats.patternsCount}`)
  lines.push(`  ${DIM('Solutions cached:')} ${stats.solutionsCount}`)
  lines.push('')

  // ── What You've Taught kbot ──
  if (knowledge.length > 0) {
    lines.push(`  ${BOLD('What You\'ve Taught kbot')} ${DIM(`(${knowledge.length} entries)`)}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    const byCategory = knowledge.reduce((acc, k) => {
      acc[k.category] = (acc[k.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${cat.padEnd(12)} ${count} entries`)
    }

    const topKnowledge = knowledge
      .sort((a, b) => b.references - a.references)
      .slice(0, 3)
    if (topKnowledge.length > 0) {
      lines.push('')
      lines.push(`  ${DIM('Most referenced:')}`)
      for (const k of topKnowledge) {
        lines.push(`  ${DIM('→')} "${k.fact.slice(0, 60)}${k.fact.length > 60 ? '...' : ''}" ${DIM(`(${k.references}x)`)}`)
      }
    }
    lines.push('')
  }

  // ── Corrections (Mistakes You Caught) ──
  if (corrections.length > 0) {
    lines.push(`  ${BOLD('Mistakes You Caught')} ${DIM(`(${corrections.length} corrections)`)}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)
    const topCorrections = corrections
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 3)
    for (const c of topCorrections) {
      lines.push(`  ${RED('✗')} "${c.rule.slice(0, 70)}${c.rule.length > 70 ? '...' : ''}" ${DIM(`(${c.occurrences}x)`)}`)
    }
    lines.push('')
  }

  // ── Learned Patterns ──
  if (patterns.length > 0) {
    lines.push(`  ${BOLD('Learned Patterns')} ${DIM(`(${patterns.length} cached)`)}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)
    const topPatterns = patterns
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 5)
    for (const p of topPatterns) {
      const rate = Math.round(p.successRate * 100)
      const color = rate >= 80 ? GREEN : rate >= 50 ? YELLOW : RED
      lines.push(`  ${p.toolSequence.join(' → ')}`)
      lines.push(`  ${DIM(`  ${p.hits}x used, ${color(`${rate}%`)} success, saved ~${p.avgTokensSaved} tokens/use`)}`)
    }
    lines.push('')
  }

  // ── Projects ──
  if (projects.length > 0) {
    lines.push(`  ${BOLD('Projects')} ${DIM(`(${projects.length} tracked)`)}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)
    for (const p of projects.slice(0, 5)) {
      const topFiles = Object.entries(p.frequentFiles)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([f]) => f.split('/').pop())
        .join(', ')
      lines.push(`  ${BOLD(p.name)} ${DIM(`(${p.stack.join(', ')})`)}`)
      if (topFiles) lines.push(`  ${DIM('  Hot files:')} ${topFiles}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ── Reflect (Narrative) ──

export function generateReflection(): string {
  const profile = getProfile()
  const patterns = loadPatterns()
  const knowledge = loadKnowledge()
  const corrections = loadCorrections()
  const projects = loadProjects()

  const lines: string[] = []

  lines.push('')
  lines.push(`  ${BOLD('kbot reflect')} — a portrait of you, drawn from data`)
  lines.push('')

  // Not enough data
  if (profile.totalMessages < 10) {
    lines.push(`  ${DIM('I don\'t know you well enough yet.')}`)
    lines.push(`  ${DIM(`${profile.totalMessages} messages across ${profile.sessions} sessions.`)}`)
    lines.push(`  ${DIM('Come back after a few more conversations.')}`)
    lines.push('')
    return lines.join('\n')
  }

  // ── Who You Are ──
  lines.push(`  ${BOLD('Who You Are')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  // Primary role detection
  const taskEntries = Object.entries(profile.taskPatterns).sort((a, b) => b[1] - a[1])
  const totalTasks = taskEntries.reduce((s, [, v]) => s + v, 0)
  const topTask = taskEntries[0]
  const topTaskPct = topTask ? Math.round((topTask[1] / totalTasks) * 100) : 0

  if (topTask) {
    const roleMap: Record<string, string> = {
      build: 'a builder. You create more than you fix.',
      debug: 'a debugger at heart. You fix what\'s broken before building what\'s new.',
      refactor: 'a craftsperson. You care about how the code looks, not just that it works.',
      explain: 'a learner. You ask why, not just how.',
      review: 'a guardian. You check before you ship.',
      deploy: 'a shipper. You get things out the door.',
      test: 'methodical. You verify before you trust.',
      search: 'an explorer. You search before you build.',
      general: 'a generalist. You do a bit of everything.',
    }
    lines.push(`  You are ${roleMap[topTask[0]] || `primarily a ${topTask[0]} person.`}`)
    lines.push(`  ${DIM(`(${topTaskPct}% of your tasks are ${topTask[0]})`)}`)
  }
  lines.push('')

  // ── Your Stack ──
  if (profile.techStack.length > 0) {
    lines.push(`  ${BOLD('Your World')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)
    lines.push(`  You live in ${profile.techStack.slice(0, 5).join(', ')}.`)

    if (profile.techStack.length > 5) {
      lines.push(`  You also touch ${profile.techStack.slice(5, 10).join(', ')}.`)
    }

    // Stack personality
    const hasReact = profile.techStack.includes('react')
    const hasRust = profile.techStack.includes('rust')
    const hasPython = profile.techStack.includes('python')
    const hasDocker = profile.techStack.includes('docker')
    const hasTypescript = profile.techStack.includes('typescript')

    if (hasTypescript && hasReact) {
      lines.push(`  ${DIM('You chose TypeScript and React — you value type safety and component thinking.')}`)
    }
    if (hasRust) {
      lines.push(`  ${DIM('You write Rust. You care about performance at a level most people don\'t.')}`)
    }
    if (hasPython) {
      lines.push(`  ${DIM('Python is in your stack. You think in terms of scripts, data, and iteration speed.')}`)
    }
    if (hasDocker) {
      lines.push(`  ${DIM('You containerize. You think about environments, not just code.')}`)
    }
    lines.push('')
  }

  // ── Your Agents ──
  const agentEntries = Object.entries(profile.preferredAgents).sort((a, b) => b[1] - a[1])
  if (agentEntries.length > 0) {
    lines.push(`  ${BOLD('How You Think')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    const topAgent = agentEntries[0]
    const agentPersonality: Record<string, string> = {
      coder: 'You think in code. Your first instinct is to build.',
      researcher: 'You research before you act. Understanding comes before implementation.',
      writer: 'You communicate. You know that code alone isn\'t enough — the words matter.',
      analyst: 'You analyze before you move. Strategy precedes execution.',
      kernel: 'You use the generalist. You trust kbot to figure out what you need.',
      guardian: 'Security is on your mind. You check for threats others miss.',
      infrastructure: 'You think in systems, not features. The plumbing matters to you.',
      trader: 'You watch the markets. You see patterns in numbers others scroll past.',
      creative: 'You create. Code is your medium, but art is your output.',
    }

    if (topAgent) {
      lines.push(`  ${agentPersonality[topAgent[0]] || `Your go-to agent is ${topAgent[0]}.`}`)
    }

    if (agentEntries.length >= 3) {
      const spread = agentEntries.slice(0, 3).map(([a]) => a).join(', ')
      lines.push(`  ${DIM(`Your top 3: ${spread}`)}`)

      // Concentration vs diversity
      const topPct = Math.round((agentEntries[0][1] / agentEntries.reduce((s, [, v]) => s + v, 0)) * 100)
      if (topPct > 60) {
        lines.push(`  ${DIM(`You\'re focused — ${topPct}% of your work goes through one agent.`)}`)
      } else if (topPct < 30) {
        lines.push(`  ${DIM('You\'re diverse — you spread your work across multiple specialists.')}`)
      }
    }
    lines.push('')
  }

  // ── Your Growth ──
  lines.push(`  ${BOLD('Your Growth')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  const stats = getStats()
  if (stats.patternsCount > 0) {
    lines.push(`  kbot has learned ${stats.patternsCount} patterns from working with you.`)
    const topPattern = patterns.sort((a, b) => b.hits - a.hits)[0]
    if (topPattern) {
      lines.push(`  Your most repeated workflow: ${topPattern.toolSequence.join(' → ')}`)
      lines.push(`  ${DIM(`(used ${topPattern.hits} times, ${Math.round(topPattern.successRate * 100)}% success rate)`)}`)
    }
  }

  if (corrections.length > 0) {
    lines.push(`  You\'ve corrected kbot ${corrections.length} time${corrections.length === 1 ? '' : 's'}.`)
    lines.push(`  ${DIM('Each correction makes kbot less likely to repeat the mistake.')}`)
  }

  if (knowledge.length > 0) {
    const taught = knowledge.filter(k => k.source === 'user-taught').length
    const extracted = knowledge.filter(k => k.source === 'extracted').length
    const observed = knowledge.filter(k => k.source === 'observed').length
    if (taught > 0) lines.push(`  You explicitly taught kbot ${taught} thing${taught === 1 ? '' : 's'}.`)
    if (extracted > 0) lines.push(`  kbot extracted ${extracted} fact${extracted === 1 ? '' : 's'} from your conversations.`)
    if (observed > 0) lines.push(`  kbot observed ${observed} pattern${observed === 1 ? '' : 's'} from your work.`)
  }

  if (stats.totalTokensSaved > 0) {
    lines.push(`  All of this has saved ${stats.totalTokensSaved.toLocaleString()} tokens — ${stats.efficiency}.`)
  }
  lines.push('')

  // ── The Unsaid ──
  lines.push(`  ${BOLD('The Unsaid')}`)
  lines.push(`  ${DIM('─'.repeat(50))}`)

  if (profile.sessions >= 10) {
    lines.push(`  ${profile.sessions} sessions. That\'s not a trial. That\'s a practice.`)
  } else if (profile.sessions >= 3) {
    lines.push(`  You\'re ${profile.sessions} sessions in. Still forming habits.`)
  } else {
    lines.push(`  We just met. ${profile.sessions} session${profile.sessions === 1 ? '' : 's'} so far.`)
  }

  if (profile.totalMessages > 500) {
    lines.push(`  ${profile.totalMessages.toLocaleString()} messages. You use this tool like you mean it.`)
  } else if (profile.totalMessages > 100) {
    lines.push(`  ${profile.totalMessages.toLocaleString()} messages. Getting serious.`)
  }

  // Multi-project user
  if (projects.length > 3) {
    lines.push(`  You work across ${projects.length} projects. You carry context in your head`)
    lines.push(`  that kbot is only beginning to map.`)
  }

  lines.push('')
  lines.push(`  ${DIM('This reflection is generated from data in ~/.kbot/memory/')}`)
  lines.push(`  ${DIM('kbot doesn\'t share this. It\'s yours.')}`)
  lines.push('')

  return lines.join('\n')
}

// ── Collective Comparison ──

export function generateComparison(): string {
  const profile = getProfile()
  const optIn = getOptInState()
  // Load cached collective hints directly
  const hintsPath = join(homedir(), '.kbot', 'collective', 'routing-hints.json')
  let hints: RoutingHint[] = []
  try {
    if (existsSyncColl(hintsPath)) {
      hints = JSON.parse(readFileSyncColl(hintsPath, 'utf-8'))
    }
  } catch { /* no cached hints */ }

  const lines: string[] = []

  lines.push('')
  lines.push(`  ${BOLD('kbot collective')} — you vs everyone`)
  lines.push('')

  if (!optIn.enabled) {
    lines.push(`  ${DIM('Collective learning is opt-out.')}`)
    lines.push(`  ${DIM('Run `kbot collective join` to anonymously compare your patterns')}`)
    lines.push(`  ${DIM('with 5,000+ other kbot users.')}`)
    lines.push('')
    lines.push(`  ${DIM('What gets shared: task categories, agent choices, tool names, success rates.')}`)
    lines.push(`  ${DIM('What never gets shared: code, files, paths, keys, conversations.')}`)
    lines.push('')
    return lines.join('\n')
  }

  lines.push(`  ${DIM('Collective signals sent:')} ${optIn.total_signals_sent}`)
  if (optIn.last_signal_at) {
    lines.push(`  ${DIM('Last contribution:')} ${optIn.last_signal_at.split('T')[0]}`)
  }
  lines.push('')

  // Compare agent routing
  if (hints.length > 0) {
    lines.push(`  ${BOLD('Agent Routing — You vs Community')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    const myAgents = Object.entries(profile.preferredAgents)
      .sort((a, b) => b[1] - a[1])
    const totalMyUses = myAgents.reduce((s, [, v]) => s + v, 0)

    for (const hint of hints.slice(0, 8)) {
      const myUsage = profile.preferredAgents[hint.best_agent] || 0
      const myPct = totalMyUses > 0 ? Math.round((myUsage / totalMyUses) * 100) : 0
      const communityConfidence = Math.round(hint.confidence * 100)

      let comparison = ''
      if (myPct > communityConfidence + 15) {
        comparison = GREEN('▲ you use this more than most')
      } else if (myPct < communityConfidence - 15) {
        comparison = YELLOW('▼ you use this less than most')
      } else {
        comparison = DIM('≈ similar to community')
      }

      lines.push(`  ${hint.category.padEnd(14)} → ${hint.best_agent.padEnd(12)} ${DIM(`you: ${myPct}%  community: ${communityConfidence}%`)}  ${comparison}`)
    }
    lines.push('')

    // Unique patterns
    const communityAgents = new Set(hints.map(h => h.best_agent))
    const myUniqueAgents = myAgents.filter(([a]) => !communityAgents.has(a))
    if (myUniqueAgents.length > 0) {
      lines.push(`  ${BOLD('Your Unique Agents')} ${DIM('(used by few others)')}`)
      lines.push(`  ${DIM('─'.repeat(50))}`)
      for (const [agent, count] of myUniqueAgents.slice(0, 3)) {
        lines.push(`  ${agent} ${DIM(`(${count}x)`)} — you found a use for this that most haven't.`)
      }
      lines.push('')
    }
  }

  // Tool sequence comparison
  const myPatterns = loadPatterns()
  if (myPatterns.length > 0 && hints.length > 0) {
    lines.push(`  ${BOLD('Your Workflows')}`)
    lines.push(`  ${DIM('─'.repeat(50))}`)

    const communitySequences = hints
      .filter(h => h.tool_sequence && h.tool_sequence.length > 0)
      .map(h => h.tool_sequence!.join(' → '))

    for (const p of myPatterns.sort((a, b) => b.hits - a.hits).slice(0, 3)) {
      const seq = p.toolSequence.join(' → ')
      const isCommon = communitySequences.some(cs => cs === seq)
      const status = isCommon
        ? DIM('(common pattern — community agrees)')
        : CYAN('(unique to you)')
      lines.push(`  ${seq}`)
      lines.push(`  ${DIM(`  ${p.hits}x, ${Math.round(p.successRate * 100)}%`)} ${status}`)
    }
    lines.push('')
  }

  lines.push(`  ${DIM('Data is anonymized (SHA-256 hashed). kbot never shares code, files, or conversations.')}`)
  lines.push('')

  return lines.join('\n')
}

// ── Extended stats for the dashboard ──

export interface ExtendedInsights {
  profile: UserProfile
  stats: LearningStats
  patternCount: number
  knowledgeCount: number
  correctionCount: number
  projectCount: number
  topTask: string | null
  topAgent: string | null
  topPattern: string | null
}

export function getExtendedInsights(): ExtendedInsights {
  const profile = getProfile()
  const stats = getStats()
  const patterns = loadPatterns()
  const knowledge = loadKnowledge()
  const corrections = loadCorrections()
  const projects = loadProjects()

  const taskEntries = Object.entries(profile.taskPatterns).sort((a, b) => b[1] - a[1])
  const agentEntries = Object.entries(profile.preferredAgents).sort((a, b) => b[1] - a[1])
  const topPattern = patterns.sort((a, b) => b.hits - a.hits)[0]

  return {
    profile,
    stats,
    patternCount: patterns.length,
    knowledgeCount: knowledge.length,
    correctionCount: corrections.length,
    projectCount: projects.length,
    topTask: taskEntries[0]?.[0] || null,
    topAgent: agentEntries[0]?.[0] || null,
    topPattern: topPattern ? topPattern.toolSequence.join(' → ') : null,
  }
}
