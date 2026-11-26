import { useEffect } from 'react'
import type { Key } from './calculator'
import { isCalculatorKey, keyAction } from './keys'

/**
 * Sends the keyboard map's actions while the calculator is mounted. It listens
 * on window, so keys work wherever focus is, except where isCalculatorKey
 * leaves them to another input or control.
 */
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
