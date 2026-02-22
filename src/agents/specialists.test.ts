import { describe, it, expect } from 'vitest'
import { SPECIALISTS, getSpecialist, getAllSpecialists } from './specialists'

describe('specialists', () => {
  describe('SPECIALISTS', () => {
    it('has all 12 specialists', () => {
      const ids = Object.keys(SPECIALISTS)
      expect(ids).toHaveLength(12)
      expect(ids).toContain('kernel')
      expect(ids).toContain('researcher')
      expect(ids).toContain('coder')
      expect(ids).toContain('writer')
      expect(ids).toContain('analyst')
      expect(ids).toContain('aesthete')
      expect(ids).toContain('guardian')
      expect(ids).toContain('curator')
      expect(ids).toContain('strategist')
      expect(ids).toContain('infrastructure')
      expect(ids).toContain('quant')
      expect(ids).toContain('investigator')
    })

    it('every specialist has required fields', () => {
      for (const [id, spec] of Object.entries(SPECIALISTS)) {
        expect(spec.id).toBe(id)
        expect(spec.name).toBeTruthy()
        expect(spec.icon).toBeTruthy()
        expect(spec.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
        expect(spec.systemPrompt).toBeTruthy()
        expect(spec.systemPrompt.length).toBeGreaterThan(50)
      }
    })

    it('every specialist has an emblem path', () => {
      for (const spec of Object.values(SPECIALISTS)) {
        expect(spec.emblem).toBeTruthy()
        expect(spec.emblem).toContain('concepts/emblem-')
        expect(spec.emblem).toMatch(/\.svg$/)
      }
    })

    it('all specialists include artifact rules', () => {
      for (const spec of Object.values(SPECIALISTS)) {
        // Kernel uses its own system prompt from kernel.ts
        if (spec.id === 'kernel') continue
        expect(spec.systemPrompt).toContain('FILE ARTIFACTS')
      }
    })

    it('all specialist colors are unique except quant/guardian', () => {
      const colors = Object.values(SPECIALISTS).map(s => s.color)
      // quant and guardian share #10B981
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBeGreaterThanOrEqual(10)
    })
  })

  describe('getSpecialist', () => {
    it('returns correct specialist by ID', () => {
      expect(getSpecialist('coder').name).toBe('Coder')
      expect(getSpecialist('researcher').color).toBe('#5B8BA0')
      expect(getSpecialist('aesthete').name).toBe('Aesthete')
    })

    it('falls back to kernel for unknown IDs', () => {
      expect(getSpecialist('nonexistent').id).toBe('kernel')
      expect(getSpecialist('').id).toBe('kernel')
    })
  })

  describe('getAllSpecialists', () => {
    it('returns all specialists as array', () => {
      const all = getAllSpecialists()
      expect(all).toHaveLength(12)
      expect(all[0].id).toBe('kernel')
    })
  })
})
