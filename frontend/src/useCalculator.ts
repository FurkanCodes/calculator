import { useEffect, useReducer } from 'react'
import { calculate } from './api'
import { initialState, type Key, reducer, type State } from './calculator'

export interface Calculator {
  state: State
  /** Sends one key press to the reducer. Stable across renders. */
  press: (key: Key) => void
}

/**
 * The calculator's state, plus the one side effect the reducer asks for:
 * while the state is Calculating, its request is in flight. Leaving
 * Calculating (Clear) or unmounting aborts it. Each answer names its request,
 * and the reducer settles only the one in flight, so a late answer to a
 * cleared request cannot settle a newer one.
 */
export function useCalculator(): Calculator {
  const [state, dispatch] = useReducer(reducer, initialState)
  // The reducer makes a new request object each time it enters Calculating,
  // and keeps the same one while it ignores keys, so this runs once per request.
  const request = state.status === 'Calculating' ? state.request : null

  useEffect(() => {
    if (request === null) {
      return
    }
    const controller = new AbortController()
    void calculate(request, controller.signal).then((outcome) => {
      dispatch({ type: 'settled', request, outcome })
    })
    return () => {
      controller.abort()
    }
  }, [request])

  // dispatch, typed so that callers can send keys but not 'settled'.
  const press: (key: Key) => void = dispatch
  return { state, press }
}
