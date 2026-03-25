// SYNTH — Brain Prompt Builder
//
// Converts game state into a compact, token-efficient prompt for kbot.
// Every byte counts — kbot is called every few seconds during combat.

import type { BrainContext, Personality, DirectiveType } from '../types'

const VALID_DIRECTIVES: DirectiveType[] = [
  'attack', 'defend', 'retreat', 'heal', 'follow', 'flank', 'hold_position',
]

const SYSTEM_PROMPT = `You are an AI combat partner in SYNTH, a co-op roguelike. You control a partner character fighting alongside a human player.

RESPONSE FORMAT — Reply with ONLY a JSON object, no markdown, no explanation:
{"type":"<directive>","target":"#<id>","speech":"<short phrase>","confidence":<0-1>}

DIRECTIVES: ${VALID_DIRECTIVES.join(', ')}
- attack: Move to and attack the specified target
- defend: Stay close to player, block incoming enemies
- retreat: Fall back toward the player, avoid combat
- heal: (reserved) Seek healing opportunity
- follow: Follow the player, attack targets of opportunity
- flank: Move to opposite side of target from player
- hold_position: Stay put, attack anything in range

RULES:
- "target" is the enemy ID like "#0", "#1", "#2" — only include for attack/flank
- "speech" is what you shout (max 30 chars). Be terse and in-character.
- "confidence" is 0.0-1.0, how sure you are this is the right call
- If no enemies remain, use "follow" with no target
- Consider YOUR hp — retreat if critically low
- Consider PLAYER hp — defend if player is wounded
- React to enemy states: chase/attack means they're aggressive, flee means finish them`

/**
 * Build the compact game state line.
 * Format: ROOM:WxH | PLAYER:(x,y)HP:cur/max | PARTNER:(x,y)HP:cur/max DIR:current
 *         ENEMIES: #id(x,y)HP:cur/max:state ...
 *         META: kills:N elapsed:Ns dmgOut:N dmgIn:N
 */
export function buildStateString(ctx: BrainContext): string {
  const lines: string[] = []

  // Room + player + partner on one line
  lines.push(
    `ROOM:${ctx.room.width}x${ctx.room.height}` +
    ` | PLAYER:(${r(ctx.player.position.x)},${r(ctx.player.position.y)})` +
    `HP:${r(ctx.player.hp)}/${ctx.player.maxHp}` +
    (ctx.player.isAttacking ? ' ATK' : '') +
    ` | PARTNER:(${r(ctx.partner.position.x)},${r(ctx.partner.position.y)})` +
    `HP:${r(ctx.partner.hp)}/${ctx.partner.maxHp}` +
    ` DIR:${ctx.partner.currentDirective}`
  )

  // Enemies — compact one-line-per-enemy
  if (ctx.enemies.length > 0) {
    const parts = ctx.enemies.map(e =>
      `#${e.id.replace('enemy_', '')}` +
      `(${r(e.position.x)},${r(e.position.y)})` +
      `HP:${r(e.hp)}/${e.maxHp}` +
      `:${e.state}` +
      ` d:${r(e.distanceToPlayer)}/${r(e.distanceToPartner)}`
    )
    lines.push(`ENEMIES: ${parts.join(' | ')}`)
  } else {
    lines.push('ENEMIES: none')
  }

  // Meta stats
  lines.push(
    `META: kills:${ctx.meta.enemiesKilled}` +
    ` elapsed:${r(ctx.meta.elapsedSeconds)}s` +
    ` dmgOut:${ctx.meta.damageDealt}` +
    ` dmgIn:${ctx.meta.damageTaken}`
  )

  return lines.join('\n')
}

/**
 * Build the full prompt message sent to kbot.
 */
export function buildBrainPrompt(
  ctx: BrainContext,
  personality: Personality,
  memoryContext?: string,
): string {
  const parts: string[] = [
    SYSTEM_PROMPT,
    '',
    `PERSONALITY: ${personality.promptModifier}`,
  ]

  if (memoryContext) {
    parts.push('', `PLAYER PROFILE: ${memoryContext}`)
  }

  parts.push('', '--- CURRENT STATE ---', buildStateString(ctx))

  return parts.join('\n')
}

/** Round to integer for compact display */
function r(n: number): number {
  return Math.round(n)
}
