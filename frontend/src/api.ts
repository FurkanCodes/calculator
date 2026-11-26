import { z } from 'zod'
import { numberSchema } from './number'

/** Relative, because nginx serves the page and the API from one origin. */
export const CALCULATE_URL = '/api/v1/calculate'

export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'
export type Operation = BinaryOperation | 'sqrt'

export interface CalculationRequest {
  operation: Operation
  operands: string[]
}

/** Every code the API can send (CLAUDE.md rule 5), including nginx's SERVICE_UNAVAILABLE. */
export const ERROR_CODES = [
  'INVALID_REQUEST',
  'INVALID_NUMBER',
  'WRONG_OPERAND_COUNT',
  'UNSUPPORTED_OPERATION',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'INPUT_TOO_LARGE',
  'DIVISION_BY_ZERO',
  'NEGATIVE_SQUARE_ROOT',
  'INVALID_EXPONENT',
  'OUT_OF_RANGE',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

// Every result is a valid operand (rule 7), so a result that is not one is
// treated as a broken response.
const successSchema = z.object({ result: numberSchema, exact: z.boolean() })
// A well-formed error with a code this client doesn't know yet (from a newer
// backend, say) is still the service answering, so it is an error with code
// null, whose message the UI shows, not "unreachable".
const errorSchema = z.object({
  error: z.object({
    code: z.string().transform((code) => (ERROR_CODES as readonly string[]).includes(code) ? (code as ErrorCode) : null),
    message: z.string(),
  }),
})

export type CalculateOutcome =
  | { kind: 'success'; result: string; exact: boolean }
  /** The API answered with its JSON error format. code is null for a code this client doesn't know. */
  | { kind: 'error'; code: ErrorCode | null; message: string }
  /** No answer, or one that is not the API's format, such as a proxy's HTML page. */
  | { kind: 'unreachable' }
  /** The caller aborted the request. */
  | { kind: 'aborted' }

/** Sends one calculation. It never throws: every outcome is a value. */
export async function calculate(
  request: CalculationRequest,
  signal?: AbortSignal,
): Promise<CalculateOutcome> {
  let response: Response
  let body: unknown
  try {
    response = await fetch(CALCULATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
    body = await response.json()
  } catch {
    // fetch rejects on a network failure or an abort; json() on a body that
    // is not JSON, or on an abort while reading it.
    return signal?.aborted ? { kind: 'aborted' } : { kind: 'unreachable' }
  }

  if (response.ok) {
    const success = successSchema.safeParse(body)
    if (success.success) {
      return { kind: 'success', ...success.data }
    }
  } else {
    const failure = errorSchema.safeParse(body)
    if (failure.success) {
      return { kind: 'error', ...failure.data.error }
    }
  }
  return { kind: 'unreachable' }
}
