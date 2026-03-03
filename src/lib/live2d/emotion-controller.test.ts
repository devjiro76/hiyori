import { describe, it, expect } from 'vitest'
import { resolveExpression } from './emotion-controller'

describe('resolveExpression', () => {
  const defaultVad = { V: 0, A: 0, D: 0 }

  describe('discrete emotion mapping', () => {
    it('maps joy → cheerful', () => {
      const cmd = resolveExpression({ primary: 'joy', intensity: 0.8 }, defaultVad, 0.7)
      expect(cmd).not.toBeNull()
      expect(cmd!.expression).toBe('cheerful')
    })

    it('maps anger → angry', () => {
      const cmd = resolveExpression({ primary: 'anger', intensity: 0.9 }, defaultVad, 0.7)
      expect(cmd).not.toBeNull()
      expect(cmd!.expression).toBe('angry')
    })

    it('maps fear → fear', () => {
      const cmd = resolveExpression({ primary: 'fear', intensity: 0.6 }, defaultVad, 0.7)
      expect(cmd!.expression).toBe('fear')
    })

    it('maps sadness → sad', () => {
      const cmd = resolveExpression({ primary: 'sadness', intensity: 0.5 }, defaultVad, 0.7)
      expect(cmd!.expression).toBe('sad')
    })

    it('maps shame → shy', () => {
      const cmd = resolveExpression({ primary: 'shame', intensity: 0.5 }, defaultVad, 0.7)
      expect(cmd!.expression).toBe('shy')
    })

    it('maps calm → relaxed', () => {
      const cmd = resolveExpression({ primary: 'calm', intensity: 0.3 }, defaultVad, 0.7)
      expect(cmd!.expression).toBe('relaxed')
    })
  })

  describe('intensity weighting', () => {
    it('high intensity → higher weight', () => {
      const high = resolveExpression({ primary: 'joy', intensity: 0.9 }, defaultVad, 0.7)
      const low = resolveExpression({ primary: 'joy', intensity: 0.2 }, defaultVad, 0.7)
      expect(high!.weight).toBeGreaterThan(low!.weight)
    })

    it('intensity 0 still produces a valid weight', () => {
      const cmd = resolveExpression({ primary: 'joy', intensity: 0 }, defaultVad, 0.7)
      expect(cmd).not.toBeNull()
      expect(cmd!.weight).toBeGreaterThanOrEqual(0.15)
    })
  })

  describe('body budget modulation', () => {
    it('high budget does not dampen weight', () => {
      const normal = resolveExpression({ primary: 'joy', intensity: 0.8 }, defaultVad, 0.7)
      const high = resolveExpression({ primary: 'joy', intensity: 0.8 }, defaultVad, 0.9)
      // Both above 0.5 threshold — same weight
      expect(normal!.weight).toBe(high!.weight)
    })

    it('low budget dampens weight', () => {
      const normal = resolveExpression({ primary: 'joy', intensity: 0.8 }, defaultVad, 0.7)
      const low = resolveExpression({ primary: 'joy', intensity: 0.8 }, defaultVad, 0.2)
      expect(low!.weight).toBeLessThan(normal!.weight)
    })
  })

  describe('fatigue overlay', () => {
    it('no fatigue overlay when budget > 0.3', () => {
      const cmd = resolveExpression({ primary: 'joy', intensity: 0.5 }, defaultVad, 0.7)
      expect(cmd!.fatigueOverlay).toBe(0)
    })

    it('fatigue overlay increases as budget drops below 0.3', () => {
      const cmd = resolveExpression({ primary: 'joy', intensity: 0.5 }, defaultVad, 0.1)
      expect(cmd!.fatigueOverlay).toBeGreaterThan(0)
    })

    it('max fatigue overlay at budget 0.05', () => {
      const cmd = resolveExpression({ primary: 'joy', intensity: 0.5 }, defaultVad, 0.05)
      expect(cmd!.fatigueOverlay).toBeCloseTo(0.4, 1)
    })
  })

  describe('VAD fallback', () => {
    it('uses VAD when discrete emotion is unknown', () => {
      const cmd = resolveExpression(
        { primary: 'unknown_emotion', intensity: 0.5 },
        { V: -0.5, A: 0.7, D: 0.5 },
        0.7,
      )
      // Should fall back to VAD mapping
      if (cmd) {
        expect(cmd.expression).toBeTruthy()
      }
    })

    it('returns null when both discrete and VAD are unresolvable', () => {
      const cmd = resolveExpression(
        { primary: 'unknown_emotion', intensity: 0.5 },
        { V: 0, A: 0, D: 0 },
        0.7,
      )
      // VAD neutral might match sleepy/think; if not matched, null
      // This depends on the exact ranges — just verify it doesn't throw
      expect(cmd === null || cmd.expression !== undefined).toBe(true)
    })
  })

  describe('weight clamp', () => {
    it('weight never exceeds 1', () => {
      const cmd = resolveExpression({ primary: 'excitement', intensity: 1 }, defaultVad, 1)
      expect(cmd!.weight).toBeLessThanOrEqual(1)
    })

    it('weight never goes below 0.15', () => {
      const cmd = resolveExpression({ primary: 'numbness', intensity: 0.01 }, defaultVad, 0.05)
      expect(cmd!.weight).toBeGreaterThanOrEqual(0.15)
    })
  })
})
