import { describe, expect, it } from 'vitest'
import cases from '../../testdata/numbers.json'
import { isValidNumber, numberErrorCode, numberSchema } from './number'

// The shared cases the Go tests also run (CLAUDE.md rule 8).
describe('numberSchema against testdata/numbers.json', () => {
  it.each(cases.accepted)('accepts %j', (s) => {
    expect(numberSchema.safeParse(s).success).toBe(true)
    expect(numberErrorCode(s)).toBeNull()
    expect(isValidNumber(s)).toBe(true)
  })

  const rejected = Object.entries(cases.rejected).flatMap(([code, values]) =>
    values.map((value) => [value, code] as const),
  )

  it.each(rejected)('rejects %j with %s', (s, code) => {
    expect(isValidNumber(s)).toBe(false)
    expect(numberErrorCode(s)).toBe(code)
  })

  it('covers every rule', () => {
    expect(Object.keys(cases.rejected).sort()).toEqual(
      ['INPUT_TOO_LARGE', 'INVALID_NUMBER', 'OUT_OF_RANGE'],
    )
  })
})

describe('numberErrorCode', () => {
  it('rejects a non-string as INVALID_NUMBER, as the backend does a JSON number', () => {
    expect(numberErrorCode(0.1)).toBe('INVALID_NUMBER')
    expect(numberErrorCode(null)).toBe('INVALID_NUMBER')
  })

  it('measures length in UTF-8 bytes, like Go', () => {
    // 129 characters but 258 bytes: the backend checks length first.
    expect(numberErrorCode('٣'.repeat(129))).toBe('INPUT_TOO_LARGE')
    expect(numberErrorCode('٣'.repeat(128))).toBe('INVALID_NUMBER')
  })

  it('checks the length before the format', () => {
    expect(numberErrorCode('x'.repeat(257))).toBe('INPUT_TOO_LARGE')
  })

  it('does not count leading or trailing zeros as significant', () => {
    expect(numberErrorCode(`000${'1'.repeat(34)}000`)).toBeNull()
    expect(numberErrorCode(`0.000${'1'.repeat(34)}000`)).toBeNull()
    expect(numberErrorCode(`1${'0'.repeat(32)}1.1`)).toBe('INPUT_TOO_LARGE')
  })

  it('treats a long zero as zero, not out of range', () => {
    expect(numberErrorCode(`0.${'0'.repeat(200)}`)).toBeNull()
    expect(numberErrorCode(`-${'0'.repeat(200)}`)).toBeNull()
  })
})
