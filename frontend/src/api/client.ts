import { z } from 'zod'
import { numberSchema } from '../validation/number'

// Zod 4 probes for `new Function` on the first z.object(), which the CSP
// blocks and the browser reports. Keep this above every schema.
z.config({ jitless: true })

/** Relative: nginx serves the page and the API from one origin. */
export const CALCULATE_URL = '/api/v1/calculate'

export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'percentage'
export type Operation = BinaryOperation | 'sqrt'

export interface CalculationRequest {
  operation: Operation
  operands: string[]
}

/** Every code in CLAUDE.md rule 5, including SERVICE_UNAVAILABLE, which only nginx sends. */
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

// Results follow the operand rules (rule 7), so one that doesn't is a broken response.
const successSchema = z.object({ result: numberSchema, exact: z.boolean() })
// An unknown code (from a newer backend, say) is still a real answer. It
// becomes code null and the UI shows the backend's message.
const errorSchema = z.object({
  error: z.object({
    code: z.union([z.enum(ERROR_CODES), z.string().transform(() => null)]),
    message: z.string(),
  }),
})

export type CalculateOutcome =
  | { kind: 'success'; result: string; exact: boolean }
  | { kind: 'error'; code: ErrorCode | null; message: string }
  /** JSON that breaks the contract, such as a 200 whose result is not a number. */
  | { kind: 'invalidResponse' }
  /** No answer, or a body that isn't JSON, such as a proxy's HTML error page. */
  | { kind: 'unreachable' }

/** Never throws. Every outcome comes back as a value. */
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
    // Network failures, non-JSON bodies and aborts all land here. Nobody waits
    // on an aborted request, and the reducer would ignore its answer anyway.
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
