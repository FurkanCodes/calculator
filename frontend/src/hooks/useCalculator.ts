import { useEffect, useReducer } from 'react'
import { calculate } from '../api/client'
import { initialState, type Key, reducer, type State } from '../calculator/reducer'

export interface Calculator {
  state: State
  /** Stable across renders. */
  press: (key: Key) => void
}

/**
 * Runs the one side effect the reducer asks for. While the state is
 * Calculating its request is in flight, and Clear or unmounting aborts it.
 */
export function useCalculator(): Calculator {
  const [state, dispatch] = useReducer(reducer, initialState)
  // The request object changes only on entering Calculating, so the effect runs once per request.
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

  // Typed so callers can send keys but not 'settled'.
  const press: (key: Key) => void = dispatch
  return { state, press }
}
