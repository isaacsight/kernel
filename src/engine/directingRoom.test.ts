import { describe, expect, it } from 'vitest'
import { createDirectingRoomBlueprint, DIRECTING_ROOM_ROLES } from './directingRoom'

describe('createDirectingRoomBlueprint', () => {
  it('preserves the raw idea as the first planning input', () => {
    const room = createDirectingRoomBlueprint('A quiet film about delegated craft.')
    expect(room.nodes[0]).toMatchObject({ id: 'idea-intake', kind: 'prompt', content: 'A quiet film about delegated craft.' })
  })

  it('creates one distinct node for every directing intelligence', () => {
    const room = createDirectingRoomBlueprint()
    expect(room.nodes.filter(node => node.kind === 'agent').map(node => node.title)).toEqual([...DIRECTING_ROOM_ROLES])
  })

  it('keeps planning separate from generation and paid execution', () => {
    const room = createDirectingRoomBlueprint()
    expect(room.nodes.every(node => ['prompt', 'agent', 'output'].includes(node.kind))).toBe(true)
    expect(room.nodes.some(node => /paid execution must remain unapproved/i.test(node.content))).toBe(true)
  })

  it('requires every specialist review before the greenlight packet', () => {
    const room = createDirectingRoomBlueprint()
    const inputs = room.edges.filter(edge => edge.to === 'greenlight-packet').map(edge => edge.from)
    expect(inputs).toEqual(['creative-director', 'director', 'vfx-supervisor', 'editor'])
  })

  it('opens with the whole room framed beside the GALLEY panel', () => {
    expect(createDirectingRoomBlueprint().view).toEqual({ x: 12, y: 150, zoom: 0.48 })
  })
})
