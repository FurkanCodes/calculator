import type { ErrorCode } from '../api/client'
import type { Failure } from './reducer'

/** What the display shows in place of the value when a calculation fails. */
export interface FailureText {
  /** 'unreachable' gets the no-connection icon; 'error' the warning icon. */
  reason: 'error' | 'unreachable'
  message: string
  /** The footer line: what to do next. */
  hint: string
}

const START_AGAIN = 'Type a number to start again.'

const UNREACHABLE: FailureText = {
  reason: 'unreachable',
  message: 'Can’t reach the calculator.',
  hint: 'Check your connection, then try again.',
}

/**
 * The text for each code the API can send. The codes themselves are never
 * shown. SERVICE_UNAVAILABLE is missing on purpose: nginx sends it when the
 * calculator is down, which is the unreachable state.
 */
export const ERROR_MESSAGES: Record<Exclude<ErrorCode, 'SERVICE_UNAVAILABLE'>, string> = {
  INVALID_REQUEST: 'The calculator couldn’t read that request.',
  INVALID_NUMBER: 'That isn’t a number the calculator accepts.',
  WRONG_OPERAND_COUNT: 'That operation got the wrong number of values.',
  UNSUPPORTED_OPERATION: 'The calculator doesn’t know that operation.',
  NOT_FOUND: 'The calculator service wasn’t found.',
  METHOD_NOT_ALLOWED: 'The calculator didn’t accept that request.',
  INPUT_TOO_LARGE: 'That number is too long for the calculator.',
  DIVISION_BY_ZERO: 'Can’t divide by zero.',
  NEGATIVE_SQUARE_ROOT: 'Can’t take the square root of a negative number.',
  INVALID_EXPONENT: 'The power must be a whole number from −1000 to 1000.',
  OUT_OF_RANGE: 'The result is too large or too small to show.',
  INTERNAL_ERROR: 'The calculator hit an unexpected problem.',
}

const FALLBACK_MESSAGE = 'Something went wrong in the calculator.'

/** An answer that breaks the API's contract: a bug somewhere, not the user's input. */
const INVALID_RESPONSE: FailureText = {
  reason: 'error',
  message: 'Something went wrong.',
  hint: 'Try again, or press C to start over.',
}

export function failureText(failure: Failure): FailureText {
  switch (failure.kind) {
    case 'unreachable':
      return UNREACHABLE
    case 'invalidResponse':
      return INVALID_RESPONSE
    case 'error':
      if (failure.code === 'SERVICE_UNAVAILABLE') {
        return UNREACHABLE
      }
      // A code this client doesn't know (null) shows the backend's own message.
      return {
        reason: 'error',
        message: failure.code === null ? failure.message.trim() || FALLBACK_MESSAGE : ERROR_MESSAGES[failure.code],
        hint: START_AGAIN,
      }
  }
}
