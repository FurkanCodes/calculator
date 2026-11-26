import { z } from 'zod'

// The number rules from CLAUDE.md rule 6, the same as backend/internal/calc/number.go.
// Every check reads the string itself: nothing here turns it into a JavaScript
// number (rule 1).

/** An operand is at most this many bytes, as the backend measures it. */
export const MAX_LENGTH = 256
/** Digits from the first non-zero digit to the last. */
export const MAX_SIGNIFICANT_DIGITS = 34
/** A non-zero number has 1e-100 <= |x| < 1e100. */
const MAX_INTEGER_DIGITS = 100
const MAX_LEADING_FRACTION_ZEROS = 99

const NUMBER_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/

/** The backend's error code for each way a number can be rejected. */
export type NumberErrorCode = 'INVALID_NUMBER' | 'INPUT_TOO_LARGE' | 'OUT_OF_RANGE'

const utf8 = new TextEncoder()

/** Go's len(s): the length in UTF-8 bytes. */
function byteLength(s: string): number {
  return utf8.encode(s).length
}

/** Counts the digits from the first non-zero digit to the last. */
function significantDigits(s: string): number {
  return s.replace(/[-.]/g, '').replace(/^0+/, '').replace(/0+$/, '').length
}

/** Reports whether s is zero, or has 1e-100 <= |s| < 1e100. */
function inRange(s: string): boolean {
  const [integerPart = '', fraction = ''] = s.replace(/^-/, '').split('.')
  const integer = integerPart.replace(/^0+/, '')
  if (integer !== '') {
    return integer.length <= MAX_INTEGER_DIGITS
  }
  const leadingZeros = fraction.search(/[1-9]/)
  return leadingZeros === -1 || leadingZeros <= MAX_LEADING_FRACTION_ZEROS
}

function rule(code: NumberErrorCode, message: string) {
  // abort: true stops at the first failed check, in the backend's order.
  return { abort: true, message, params: { code } }
}

/**
 * A number string the backend accepts. The checks run in the backend's order,
 * so the first failure carries the code the backend would send for it.
 */
export const numberSchema = z
  .string()
  .refine(
    (s) => byteLength(s) <= MAX_LENGTH,
    rule('INPUT_TOO_LARGE', `A number can be at most ${MAX_LENGTH} characters long.`),
  )
  .refine(
    (s) => NUMBER_PATTERN.test(s),
    rule('INVALID_NUMBER', 'Use a plain decimal such as -12.5.'),
  )
  .refine(
    (s) => significantDigits(s) <= MAX_SIGNIFICANT_DIGITS,
    rule('INPUT_TOO_LARGE', `A number can have at most ${MAX_SIGNIFICANT_DIGITS} significant digits.`),
  )
  .refine(inRange, rule('OUT_OF_RANGE', 'A number must be zero or between 1e-100 and 1e100.'))

/** The code the backend would reject value with, or null if it is a valid number. */
export function numberErrorCode(value: unknown): NumberErrorCode | null {
  const result = numberSchema.safeParse(value)
  if (result.success) {
    return null
  }
  const issue = result.error.issues[0]
  // A value that is not a string fails before the rules; the backend calls
  // that INVALID_NUMBER too.
  return issue?.code === 'custom' ? (issue.params?.code as NumberErrorCode) : 'INVALID_NUMBER'
}

export function isValidNumber(value: string): boolean {
  return numberSchema.safeParse(value).success
}
