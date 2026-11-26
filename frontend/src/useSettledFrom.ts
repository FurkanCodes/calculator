import { useState } from 'react'
import type { State } from './calculator'
import type { Calculating } from './display'

interface Settling {
  calculating: Calculating
  /** The first state after it: the answer, or what Clear returned to. */
  next: State | null
}

/**
 * The Calculating state that the current state answers, or null. A result or
 * error is the answer only as long as it is the very state the reducer
 * settled into: after the sign key negates a result, say, the expression line
 * no longer describes it. The reducer keeps the same state object while it
 * ignores keys, so identity is what tells these apart.
 */
export function useSettledFrom(state: State): Calculating | null {
  const [settling, setSettling] = useState<Settling | null>(null)

  // Updating state while rendering is React's pattern for deriving it from an
  // earlier render. React renders again at once, before painting.
  if (state.status === 'Calculating') {
    if (settling?.calculating !== state) {
      setSettling({ calculating: state, next: null })
    }
  } else if (settling !== null && settling.next === null) {
    setSettling({ ...settling, next: state })
  }

  return settling?.next === state ? settling.calculating : null
}
