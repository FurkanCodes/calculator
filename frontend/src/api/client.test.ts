import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculate, CALCULATE_URL, type CalculationRequest } from './client'

const divide: CalculationRequest = { operation: 'divide', operands: ['1', '3'] }

function respond(status: number, body: string) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(body, { status })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function respondJSON(status: number, body: unknown) {
  return respond(status, JSON.stringify(body))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('calculate', () => {
  it('posts the request as JSON to the relative URL', async () => {
    const fetchMock = respondJSON(200, { result: '2.5', exact: true })
    const controller = new AbortController()

    await calculate({ operation: 'divide', operands: ['10', '4'] }, controller.signal)

    expect(fetchMock).toHaveBeenCalledWith(CALCULATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"operation":"divide","operands":["10","4"]}',
      signal: controller.signal,
    })
    expect(CALCULATE_URL).toBe('/api/v1/calculate')
  })

  it('returns a result and its exact flag', async () => {
    respondJSON(200, { result: '0.3333333333333333333333333333333333', exact: false })
    expect(await calculate(divide)).toEqual({
      kind: 'success',
      result: '0.3333333333333333333333333333333333',
      exact: false,
    })
  })

  it('returns a known API error with its code and message', async () => {
    respondJSON(422, { error: { code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero.' } })
    expect(await calculate(divide)).toEqual({
      kind: 'error',
      code: 'DIVISION_BY_ZERO',
      message: 'Cannot divide by zero.',
    })
  })

  it("returns nginx's JSON 503 as an API error", async () => {
    respondJSON(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again later.' } })
    expect(await calculate(divide)).toMatchObject({ kind: 'error', code: 'SERVICE_UNAVAILABLE' })
  })

  it.each([
    ['a JSON number as the result (rule 2)', 200, { result: 0.5, exact: true }],
    ['a result that is not a valid operand (rule 7)', 200, { result: '1e5', exact: true }],
    ['a success body without exact', 200, { result: '1' }],
    ['an error body with a 200 status', 200, { error: { code: 'OUT_OF_RANGE', message: 'x' } }],
    ['an error without a message', 400, { error: { code: 'INVALID_NUMBER' } }],
    ['an error code that is not a string', 400, { error: { code: 7, message: 'x' } }],
    ['a success body with an error status', 500, { result: '1', exact: true }],
  ])('treats %s as an invalid response', async (_name, status, body) => {
    respondJSON(status, body)
    expect(await calculate(divide)).toEqual({ kind: 'invalidResponse' })
  })

  it('keeps the message of an error with a code it does not know', async () => {
    respondJSON(400, { error: { code: 'NEW_CODE', message: 'Something new went wrong.' } })
    expect(await calculate(divide)).toEqual({ kind: 'error', code: null, message: 'Something new went wrong.' })
  })

  it('treats a body that is not JSON as unreachable', async () => {
    respond(502, '<html><body>502 Bad Gateway</body></html>')
    expect(await calculate(divide)).toEqual({ kind: 'unreachable' })
  })

  it('treats a network failure as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await calculate(divide)).toEqual({ kind: 'unreachable' })
  })
})
