import { z } from 'zod'

// CLAUDE.md rule 6, matching backend/internal/calc/number.go. The checks work on
// the string and never convert it to a JavaScript number (rule 1).

export const MAX_LENGTH = 256
/** Digits from the first non-zero digit to the last. */
export const MAX_SIGNIFICANT_DIGITS = 34
/** A non-zero number has 1e-100 <= |x| < 1e100. */
const MAX_INTEGER_DIGITS = 100
const MAX_LEADING_FRACTION_ZEROS = 99

const NUMBER_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/

export type NumberErrorCode = 'INVALID_NUMBER' | 'INPUT_TOO_LARGE' | 'OUT_OF_RANGE'

const utf8 = new TextEncoder()

/** Checks run in the order of parseOperand in number.go, so the first failure gives the same code. */
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

export const numberSchema = z.string().refine(isValidNumber, 'Not a valid number.')

function significantDigits(s: string): number {
  return s.replace(/[-.]/g, '').replace(/^0+/, '').replace(/0+$/, '').length
}

function inRange(s: string): boolean {
  const [integerPart = '', fraction = ''] = s.replace(/^-/, '').split('.')
  const integer = integerPart.replace(/^0+/, '')
  if (integer !== '') {
    return integer.length <= MAX_INTEGER_DIGITS
  }
  const leadingZeros = fraction.search(/[1-9]/)
  return leadingZeros === -1 || leadingZeros <= MAX_LEADING_FRACTION_ZEROS
}
