import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from './api'
import { ERROR_MESSAGES, failureText } from './errors'

describe('failureText', () => {
  const answered = ERROR_CODES.filter((code) => code !== 'SERVICE_UNAVAILABLE')

  it.each(answered)('gives %s its own message, without the code', (code) => {
    const text = failureText({ kind: 'error', code, message: 'backend text' })
    expect(text).toEqual({ reason: 'error', message: ERROR_MESSAGES[code], hint: 'Type a number to start again.' })
    expect(text.message).not.toContain(code)
    expect(text.message).not.toBe('backend text')
  })

  it('gives every code a different message', () => {
    expect(new Set(Object.values(ERROR_MESSAGES)).size).toBe(answered.length)
  })

  it('shows the backend message for a code this client does not know', () => {
    expect(failureText({ kind: 'error', code: null, message: 'Cannot frobnicate.' })).toEqual({
      reason: 'error',
      message: 'Cannot frobnicate.',
      hint: 'Type a number to start again.',
    })
  })

  it('falls back to a general message when an unknown code comes with an empty message', () => {
    expect(failureText({ kind: 'error', code: null, message: '  ' }).message).toBe(
      'Something went wrong in the calculator.',
    )
  })

  it('says something went wrong for an answer that breaks the API contract', () => {
    expect(failureText({ kind: 'invalidResponse' })).toEqual({
      reason: 'error',
      message: 'Something went wrong.',
      hint: 'Try again, or press C to start over.',
    })
  })

  const unreachable = {
    reason: 'unreachable',
    message: 'Can’t reach the calculator.',
    hint: 'Check your connection, then try again.',
  }

  it('shows the unreachable state when there is no answer', () => {
    expect(failureText({ kind: 'unreachable' })).toEqual(unreachable)
  })

  it('shows the unreachable state for SERVICE_UNAVAILABLE, which nginx sends when the calculator is down', () => {
    expect(failureText({ kind: 'error', code: 'SERVICE_UNAVAILABLE', message: 'x' })).toEqual(unreachable)
  })
})
