import { describe, expect, it } from 'vitest'
import { fittingSize, VALUE_SIZES } from './fit'

describe('fittingSize', () => {
  it('runs from 40 px down to 26 px', () => {
    expect(VALUE_SIZES[0]).toBe(40)
    expect(VALUE_SIZES.at(-1)).toBe(26)
  })

  it('uses the largest size when the text fits', () => {
    expect(fittingSize(() => true)).toBe(40)
  })

  it('steps down to the largest size that fits, trying each in turn', () => {
    const tried: number[] = []
    const size = fittingSize((px) => {
      tried.push(px)
      return px <= 32
    })
    expect(size).toBe(32)
    expect(tried).toEqual([40, 36, 32])
  })

  it('stops at 26 px when nothing fits, and the text scrolls', () => {
    expect(fittingSize(() => false)).toBe(26)
  })
})
