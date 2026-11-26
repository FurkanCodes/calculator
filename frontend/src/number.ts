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

/**
 * The code the backend would reject s with, or null if s is a valid number.
 * The checks run in the order of parseOperand in number.go, so the first one
 * that fails gives the same code.
 */
export function numberError(s: string): NumberErrorCode | null {
  // Go's len(s) is the length in UTF-8 bytes.
  if (utf8.encode(s).length > MAX_LENGTH) {
    return 'INPUT_TOO_LARGE'
  }
  if (!NUMBER_PATTERN.test(s)) {
    return 'INVALID_NUMBER'
  }
  if (significantDigits(s) > MAX_SIGNIFICANT_DIGITS) {
    return 'INPUT_TOO_LARGE'
  }
  if (!inRange(s)) {
    return 'OUT_OF_RANGE'
  }
  return null
}

export function isValidNumber(s: string): boolean {
  return numberError(s) === null
}

/** A number string the backend accepts. */
export const numberSchema = z.string().refine(isValidNumber, 'Not a valid number.')

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
