import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Key } from './calculator'
import { useCalculator } from './useCalculator'

const keys: Key[] = [
  { type: 'digit', digit: '2' },
  { type: 'operator', operator: 'add' },
  { type: 'digit', digit: '3' },
  { type: 'equals' },
]

/** A fetch the test answers by hand. It ignores the abort signal, so a late answer can be tested. */
function deferredFetch() {
  const calls: { init: RequestInit; answer: (status: number, body: unknown) => void }[] = []
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve) => {
        calls.push({
          init,
          answer: (status, body) => {
            resolve(new Response(JSON.stringify(body), { status }))
          },
        })
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

function setup() {
  const { result, unmount } = renderHook(() => useCalculator())
  const press = (...pressed: Key[]) => {
    act(() => {
      for (const key of pressed) {
        result.current.press(key)
      }
    })
  }
  return { result, unmount, press }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCalculator', () => {
  it('sends the request on entering Calculating and shows the result', async () => {
    const { fetchMock, calls } = deferredFetch()
    const { result, press } = setup()

    press(...keys)

    expect(result.current.state.status).toBe('Calculating')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls[0]?.init.body).toBe('{"operation":"add","operands":["2","3"]}')

    calls[0]?.answer(200, { result: '5', exact: true })
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ShowingResult', result: { origin: 'result', text: '5', exact: true } })
    })
  })

  it('sends one request however many keys are pressed while it is in flight', () => {
    const { fetchMock } = deferredFetch()
    const { press } = setup()

    press(...keys)
    press({ type: 'digit', digit: '9' })
    press({ type: 'equals' })
    press({ type: 'squareRoot' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('moves to Error when the API answers with an error', async () => {
    const { calls } = deferredFetch()
    const { result, press } = setup()

    press(...keys)
    calls[0]?.answer(422, { error: { code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero.' } })

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'Error',
        failure: { kind: 'error', code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero.' },
      })
    })
  })

  it('aborts the request on Clear and ignores its late answer', async () => {
    const { calls } = deferredFetch()
    const { result, press } = setup()

    press(...keys)
    press({ type: 'clear' })

    expect(calls[0]?.init.signal?.aborted).toBe(true)
    calls[0]?.answer(200, { result: '5', exact: true })
    // Let the late answer's promise chain run before checking it changed nothing.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(result.current.state).toEqual({ status: 'EnteringFirst', first: { origin: 'typed', text: '0' } })
  })

  it('settles only the latest request after Clear and a new calculation', async () => {
    const { calls } = deferredFetch()
    const { result, press } = setup()

    press(...keys)
    press({ type: 'clear' })
    press(...keys)
    expect(calls).toHaveLength(2)

    // The cleared request answers while the new one is still in flight.
    calls[0]?.answer(200, { result: '999', exact: true })
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(result.current.state.status).toBe('Calculating')

    calls[1]?.answer(200, { result: '5', exact: true })
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ShowingResult', result: { origin: 'result', text: '5', exact: true } })
    })
  })

  it('ignores the outcome of an aborted fetch that rejects', async () => {
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
    const { result, press } = setup()

    press(...keys)
    press({ type: 'clear' })
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(result.current.state).toEqual({ status: 'EnteringFirst', first: { origin: 'typed', text: '0' } })
  })

  it('aborts the request on unmount', () => {
    const { calls } = deferredFetch()
    const { press, unmount } = setup()

    press(...keys)
    unmount()

    expect(calls[0]?.init.signal?.aborted).toBe(true)
  })
})
