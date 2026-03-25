import type { Vec2, DirectiveType } from '../types'
import { PARTNER_SPEED, PARTNER_LEASH_DISTANCE, PARTNER_ATTACK_RANGE } from '../constants'

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function moveToward(from: Vec2, to: Vec2, speed: number): Vec2 {
  const d = dist(from, to)
  if (d < 1) return { x: 0, y: 0 }
  return {
    x: ((to.x - from.x) / d) * speed,
    y: ((to.y - from.y) / d) * speed,
  }
}

interface EnemyInfo {
  id: string
  position: Vec2
  hp: number
}

export function updatePartnerBehavior(
  partnerPos: Vec2,
  partnerHp: number,
  partnerMaxHp: number,
  playerPos: Vec2,
  enemies: EnemyInfo[],
  directive: DirectiveType,
): { velocity: Vec2; shouldAttack: boolean; targetId?: string } {
  const dToPlayer = dist(partnerPos, playerPos)

  // Override: retreat when critically low
  if (partnerHp / partnerMaxHp < 0.2) {
    return {
      velocity: moveToward(partnerPos, playerPos, PARTNER_SPEED),
      shouldAttack: false,
    }
  }

  // Find nearest enemy
  let nearest: EnemyInfo | null = null
  let nearestDist = Infinity
  for (const e of enemies) {
    const d = dist(partnerPos, e.position)
    if (d < nearestDist) {
      nearest = e
      nearestDist = d
    }
  }

  switch (directive) {
    case 'follow':
      // Follow player, attack targets of opportunity
      if (nearest && nearestDist < PARTNER_ATTACK_RANGE) {
        return {
          velocity: moveToward(partnerPos, nearest.position, PARTNER_SPEED),
          shouldAttack: true,
          targetId: nearest.id,
        }
      }
      if (dToPlayer > PARTNER_LEASH_DISTANCE) {
        return { velocity: moveToward(partnerPos, playerPos, PARTNER_SPEED), shouldAttack: false }
      }
      return { velocity: { x: 0, y: 0 }, shouldAttack: false }

    case 'attack':
      if (nearest) {
        return {
          velocity: moveToward(partnerPos, nearest.position, PARTNER_SPEED),
          shouldAttack: nearestDist < PARTNER_ATTACK_RANGE,
          targetId: nearest.id,
        }
      }
      return { velocity: moveToward(partnerPos, playerPos, PARTNER_SPEED), shouldAttack: false }

    case 'defend':
      // Stay close to player, only attack if enemies are very close
      if (nearest && nearestDist < PARTNER_ATTACK_RANGE * 0.5) {
        return { velocity: { x: 0, y: 0 }, shouldAttack: true, targetId: nearest.id }
      }
      if (dToPlayer > PARTNER_LEASH_DISTANCE * 0.5) {
        return { velocity: moveToward(partnerPos, playerPos, PARTNER_SPEED), shouldAttack: false }
      }
      return { velocity: { x: 0, y: 0 }, shouldAttack: false }

    case 'retreat':
      // Run toward player, don't fight
      return { velocity: moveToward(partnerPos, playerPos, PARTNER_SPEED * 1.2), shouldAttack: false }

    case 'flank':
      // Move to opposite side of nearest enemy from player
      if (nearest) {
        const flankX = nearest.position.x + (nearest.position.x - playerPos.x) * 0.5
        const flankY = nearest.position.y + (nearest.position.y - playerPos.y) * 0.5
        return {
          velocity: moveToward(partnerPos, { x: flankX, y: flankY }, PARTNER_SPEED),
          shouldAttack: nearestDist < PARTNER_ATTACK_RANGE,
          targetId: nearest.id,
        }
      }
      return { velocity: moveToward(partnerPos, playerPos, PARTNER_SPEED), shouldAttack: false }

    default:
      return { velocity: { x: 0, y: 0 }, shouldAttack: false }
  }
}
