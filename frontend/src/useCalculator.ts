import { useEffect, useReducer } from 'react'
import { calculate } from './api'
import { initialState, reducer } from './calculator'

/**
 * The calculator's state, plus the one side effect the reducer asks for:
 * while the state is Calculating, its request is in flight. Leaving
 * Calculating (Clear) or unmounting aborts it, and only the request for the
 * current Calculating state can settle it.
 */
export function useCalculator() {
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
      if (!controller.signal.aborted && outcome.kind !== 'aborted') {
        dispatch({ type: 'settled', outcome })
      }
    })
    return () => {
      controller.abort()
    }
  }, [request])

  return [state, dispatch] as const
}
