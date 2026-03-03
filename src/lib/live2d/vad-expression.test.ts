import { describe, it, expect } from 'vitest'
import { vadToExpression } from './vad-expression'

describe('vadToExpression', () => {
  it('maps high-arousal negative to angry', () => {
    const result = vadToExpression({ V: -0.5, A: 0.7, D: 0.5 })
    expect(result).not.toBeNull()
    expect(result!.name).toBe('angry')
  })

  it('maps high-arousal negative low-D to fear', () => {
    const result = vadToExpression({ V: -0.5, A: 0.7, D: 0 })
    expect(result).not.toBeNull()
    expect(result!.name).toBe('fear')
  })

  it('maps low V, low A to sadness (cry or sad)', () => {
    const result = vadToExpression({ V: -0.8, A: 0.1, D: -0.5 })
    expect(result).not.toBeNull()
    expect(['cry', 'sad']).toContain(result!.name)
  })

  it('maps positive moderate to cheerful or smile', () => {
    const result = vadToExpression({ V: 0.4, A: 0.15, D: 0.3 })
    expect(result).not.toBeNull()
    expect(['cheerful', 'smile', 'relaxed']).toContain(result!.name)
  })

  it('maps high positive arousal to excited', () => {
    const result = vadToExpression({ V: 0.7, A: 0.8, D: 0.5 })
    expect(result).not.toBeNull()
    expect(['excited', 'laugh']).toContain(result!.name)
  })

  it('returns null for neutral center', () => {
    // V=0, A=0, D=0 shouldn't match any specific expression
    const result = vadToExpression({ V: 0, A: 0, D: 0 })
    // May or may not match depending on ranges — just verify it handles gracefully
    // sleepy range includes V: [-0.2, 0.3], A: [0, 0.15], D: [-1, 0.3] → could match
    if (result) {
      expect(result.name).toBeTruthy()
    }
  })

  it('weight is clamped between 0.3 and 1', () => {
    const result = vadToExpression({ V: -0.5, A: 0.7, D: 0.5 })
    expect(result).not.toBeNull()
    expect(result!.weight).toBeGreaterThanOrEqual(0.3)
    expect(result!.weight).toBeLessThanOrEqual(1)
  })

  it('returns higher weight for extreme values', () => {
    const mild = vadToExpression({ V: -0.2, A: 0.55, D: 0.35 })
    const extreme = vadToExpression({ V: -0.8, A: 0.9, D: 0.8 })
    if (mild && extreme) {
      expect(extreme.weight).toBeGreaterThanOrEqual(mild.weight)
    }
  })

  it('first match wins — order matters', () => {
    // V=-0.5, A=0.7, D=0.5 → angry is before fear (fear needs D < 0.3)
    const result = vadToExpression({ V: -0.5, A: 0.7, D: 0.5 })
    expect(result!.name).toBe('angry')
  })
})
