import { useEffect } from 'react'
import type { Key } from '../calculator/reducer'
import { isCalculatorKey, keyAction } from '../calculator/keys'

/** Listens on window so keys work wherever focus is. isCalculatorKey decides which to leave alone. */
export function useKeyboard(press: (action: Key) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = keyAction(event.key)
      if (action === null || !isCalculatorKey(event)) {
        return
      }
      // Stops Firefox's quick find on '/', and the page scrolling.
      event.preventDefault()
      press(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [press])
}
