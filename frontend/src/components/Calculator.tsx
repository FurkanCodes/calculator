import { displayModel } from '../display'
import { useCalculator } from '../useCalculator'
import { useKeyboard } from '../useKeyboard'
import { DisplayCard } from './DisplayCard'
import { Keypad } from './Keypad'

/** The one screen: a header, the display card and the keypad, in one column. */
export function Calculator() {
  const { state, press } = useCalculator()
  useKeyboard(press)

  return (
    // The column fills the viewport exactly: the keypad shrinks to fit, and
    // the page scrolls only when even the smallest keys don't fit.
    <main className="mx-auto flex h-dvh w-full max-w-[420px] flex-col gap-4 p-4 [@media(max-height:600px)]:gap-3 [@media(max-height:600px)]:p-3">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-[17px] font-semibold">Calculator</h1>
        <p className="text-[13px] text-muted">Exact decimals</p>
      </header>
      <DisplayCard model={displayModel(state)} />
      <Keypad onPress={press} />
    </main>
  )
}
