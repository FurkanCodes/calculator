import { describe, expect, it } from 'vitest'
import cases from '../../../testdata/numbers.json'
import { isValidNumber, numberError, numberSchema } from './number'

// The shared cases the Go tests also run (CLAUDE.md rule 8).
describe('number rules against testdata/numbers.json', () => {
  it.each(cases.accepted)('accepts %j', (s) => {
    expect(numberError(s)).toBeNull()
    expect(isValidNumber(s)).toBe(true)
    expect(numberSchema.safeParse(s).success).toBe(true)
  })

  const rejected = Object.entries(cases.rejected).flatMap(([code, values]) =>
    values.map((value) => [value, code] as const),
  )

  it.each(rejected)('rejects %j with %s', (s, code) => {
    expect(numberError(s)).toBe(code)
    expect(isValidNumber(s)).toBe(false)
    expect(numberSchema.safeParse(s).success).toBe(false)
  })

  it('covers every rule', () => {
    expect(Object.keys(cases.rejected).sort()).toEqual(
      ['INPUT_TOO_LARGE', 'INVALID_NUMBER', 'OUT_OF_RANGE'],
    )
  })
})

describe('numberSchema', () => {
  it('rejects a value that is not a string', () => {
    expect(numberSchema.safeParse(0.1).success).toBe(false)
    expect(numberSchema.safeParse(null).success).toBe(false)
  })
})

describe('numberError', () => {
  it('measures length in UTF-8 bytes, like Go', () => {
    // 129 characters but 258 bytes: the backend checks length first.
    expect(numberError('٣'.repeat(129))).toBe('INPUT_TOO_LARGE')
    expect(numberError('٣'.repeat(128))).toBe('INVALID_NUMBER')
  })

  it('checks the length before the format', () => {
    expect(numberError('x'.repeat(257))).toBe('INPUT_TOO_LARGE')
  })

  it('does not count leading or trailing zeros as significant', () => {
    expect(numberError(`000${'1'.repeat(34)}000`)).toBeNull()
    expect(numberError(`0.000${'1'.repeat(34)}000`)).toBeNull()
    expect(numberError(`1${'0'.repeat(32)}1.1`)).toBe('INPUT_TOO_LARGE')
  })

  it('treats a long zero as zero, not out of range', () => {
    expect(numberError(`0.${'0'.repeat(200)}`)).toBeNull()
    expect(numberError(`-${'0'.repeat(200)}`)).toBeNull()
  })
})
