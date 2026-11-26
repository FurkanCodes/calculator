import { z } from 'zod'
import { numberSchema } from '../validation/number'

// Zod 4 probes for `new Function` support when the first object schema is
// built, which the page's CSP (script-src 'self') blocks and the browser
// reports. This must run before any z.object() call below.
z.config({ jitless: true })

/** Relative, because nginx serves the page and the API from one origin. */
export const CALCULATE_URL = '/api/v1/calculate'

export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'
export type Operation = BinaryOperation | 'sqrt'

export interface CalculationRequest {
  operation: Operation
  operands: string[]
}

/**
 * Every error code the API defines (CLAUDE.md rule 5), including the ones only
 * the optional operations send (NEGATIVE_SQUARE_ROOT, INVALID_EXPONENT) and the
 * one only nginx sends (SERVICE_UNAVAILABLE).
 */
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
// null, whose message the UI shows.
const errorSchema = z.object({
  error: z.object({
    code: z.union([z.enum(ERROR_CODES), z.string().transform(() => null)]),
    message: z.string(),
  }),
})

export type CalculateOutcome =
  | { kind: 'success'; result: string; exact: boolean }
  /** The API answered with its JSON error format. code is null for a code this client doesn't know. */
  | { kind: 'error'; code: ErrorCode | null; message: string }
  /** A JSON answer that breaks the API's contract, such as a 200 whose result is not a number. */
  | { kind: 'invalidResponse' }
  /** No answer, or a body that is not JSON, such as a proxy's HTML error page. */
  | { kind: 'unreachable' }

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
    // fetch rejects on a network failure, json() on a body that is not JSON.
    // An aborted request also ends here; nobody waits for its outcome, and the
    // reducer ignores it because it answers a request no longer in flight.
    return { kind: 'unreachable' }
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
  return { kind: 'invalidResponse' }
}
