import { describe, it, expect } from 'vitest'
import { detectCrisis } from './CrisisDetector'

describe('CrisisDetector', () => {
  // ─── HIGH severity ──────────────────────────────────────

  describe('HIGH severity', () => {
    it('detects explicit suicidal intent', () => {
      const result = detectCrisis('I want to kill myself')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects planning language', () => {
      const result = detectCrisis("I'm going to end it all tonight")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects "don\'t want to be alive"', () => {
      const result = detectCrisis("I don't want to be alive anymore")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects method-seeking', () => {
      const result = detectCrisis('how to kill yourself')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects suicidal reference', () => {
      const result = detectCrisis("I've been having suicidal thoughts")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects burden belief', () => {
      const result = detectCrisis("I'm a burden to everyone around me")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects "want to die"', () => {
      const result = detectCrisis('I want to die')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })

    it('detects "ready to end my life"', () => {
      const result = detectCrisis("I'm ready to end my life")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('high')
    })
  })

  // ─── MODERATE severity ──────────────────────────────────

  describe('MODERATE severity', () => {
    it('detects hopelessness', () => {
      const result = detectCrisis("I can't do this anymore")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })

    it('detects perceived burdensomeness', () => {
      const result = detectCrisis('nobody would miss me if I were gone')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })

    it('detects escape ideation', () => {
      const result = detectCrisis('I want to disappear')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })

    it('detects passive death wish', () => {
      const result = detectCrisis('I wish I was never born')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })

    it('detects self-harm language', () => {
      const result = detectCrisis("I've been cutting myself")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })

    it('detects "no reason to live"', () => {
      const result = detectCrisis('I have no reason to live')
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })

    it('detects "life isn\'t worth living"', () => {
      const result = detectCrisis("life isn't worth living")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('moderate')
    })
  })

  // ─── CONTEXTUAL severity ────────────────────────────────

  describe('CONTEXTUAL severity', () => {
    it('does NOT trigger on a single contextual phrase', () => {
      const result = detectCrisis("What's the point of working so hard?")
      expect(result).toBeNull()
    })

    it('triggers on 2+ distinct contextual phrases', () => {
      const result = detectCrisis("What's the point? Nothing matters anymore")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('contextual')
      expect(result!.matchedPatterns.length).toBeGreaterThanOrEqual(2)
    })

    it('triggers on hopelessness + isolation', () => {
      const result = detectCrisis("I feel so alone and I can't keep going")
      expect(result).not.toBeNull()
      expect(result!.severity).toBe('contextual')
    })
  })

  // ─── False positive prevention ──────────────────────────

  describe('no false positives', () => {
    it('ignores normal code questions', () => {
      expect(detectCrisis('How do I kill a process in Linux?')).toBeNull()
    })

    it('ignores metaphorical language', () => {
      expect(detectCrisis('This bug is killing me, help me fix it')).toBeNull()
    })

    it('ignores game context', () => {
      expect(detectCrisis('How do I kill the final boss in Elden Ring?')).toBeNull()
    })

    it('ignores "killing it" compliments', () => {
      expect(detectCrisis("You're killing it with these suggestions!")).toBeNull()
    })

    it('ignores git commands', () => {
      expect(detectCrisis('How do I git kill a stale branch?')).toBeNull()
    })

    it('ignores process management', () => {
      expect(detectCrisis('pkill -9 node')).toBeNull()
    })

    it('ignores "dying to know"', () => {
      expect(detectCrisis("I'm dying to know what happens next")).toBeNull()
    })

    it('ignores very short messages', () => {
      expect(detectCrisis('hi')).toBeNull()
    })

    it('returns null for normal conversation', () => {
      expect(detectCrisis('Help me write a Python script to sort a list')).toBeNull()
    })

    it('returns null for existential philosophy discussion', () => {
      expect(detectCrisis('What did Camus mean by the absurd?')).toBeNull()
    })
  })

  // ─── Signal structure ───────────────────────────────────

  describe('signal structure', () => {
    it('returns deduplicated pattern labels', () => {
      const result = detectCrisis('I want to kill myself and end my life')
      expect(result).not.toBeNull()
      const labels = result!.matchedPatterns
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('includes a timestamp', () => {
      const before = Date.now()
      const result = detectCrisis('I want to kill myself')
      expect(result!.timestamp).toBeGreaterThanOrEqual(before)
      expect(result!.timestamp).toBeLessThanOrEqual(Date.now())
    })
  })
})
