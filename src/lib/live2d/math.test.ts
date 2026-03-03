import { describe, it, expect } from 'vitest'
import { lerp, clamp, easeInOutCubic } from './math'

describe('lerp', () => {
  it('returns a when t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })

  it('returns b when t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('returns midpoint when t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })

  it('extrapolates beyond t=1', () => {
    expect(lerp(0, 10, 2)).toBe(20)
  })

  it('extrapolates below t=0', () => {
    expect(lerp(0, 10, -1)).toBe(-10)
  })
})

describe('clamp', () => {
  it('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('easeInOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOutCubic(0)).toBe(0)
  })

  it('returns 1 at t=1', () => {
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('returns 0.5 at t=0.5', () => {
    expect(easeInOutCubic(0.5)).toBe(0.5)
  })

  it('eases in slowly (first half < linear)', () => {
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
  })

  it('eases out slowly (second half > linear)', () => {
    expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
  })

  it('is monotonically increasing', () => {
    for (let t = 0; t < 1; t += 0.1) {
      expect(easeInOutCubic(t + 0.1)).toBeGreaterThanOrEqual(easeInOutCubic(t))
    }
  })
})
