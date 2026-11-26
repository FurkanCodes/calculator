import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculate, CALCULATE_URL, type CalculationRequest } from './api'

const divide: CalculationRequest = { operation: 'divide', operands: ['1', '3'] }

function respond(status: number, body: string) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(body, { status })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function respondJSON(status: number, body: unknown) {
  return respond(status, JSON.stringify(body))
}

/** A fetch that never answers, and rejects as the real one does when aborted. */
function hangUntilAborted() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    ),
  )
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
    ['an unknown error code', 400, { error: { code: 'TEAPOT', message: 'x' } }],
    ['an error without a message', 400, { error: { code: 'INVALID_NUMBER' } }],
    ['a success body with an error status', 500, { result: '1', exact: true }],
  ])('treats %s as unreachable', async (_name, status, body) => {
    respondJSON(status, body)
    expect(await calculate(divide)).toEqual({ kind: 'unreachable' })
  })

  it('treats a body that is not JSON as unreachable', async () => {
    respond(502, '<html><body>502 Bad Gateway</body></html>')
    expect(await calculate(divide)).toEqual({ kind: 'unreachable' })
  })

  it('treats a network failure as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await calculate(divide)).toEqual({ kind: 'unreachable' })
  })

  it('reports an aborted request as aborted', async () => {
    hangUntilAborted()
    const controller = new AbortController()

    const outcome = calculate(divide, controller.signal)
    controller.abort()

    expect(await outcome).toEqual({ kind: 'aborted' })
  })

  it('reports an abort while the body is read as aborted', async () => {
    const controller = new AbortController()
    const response = new Response('{}', { status: 200 })
    vi.spyOn(response, 'json').mockImplementation(() => {
      controller.abort()
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
    })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)))

    expect(await calculate(divide, controller.signal)).toEqual({ kind: 'aborted' })
  })
})
