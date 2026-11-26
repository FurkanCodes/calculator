import { displayModel } from '../display'
import { useCalculator } from '../useCalculator'
import { useKeyboard } from '../useKeyboard'
import { useSettledFrom } from '../useSettledFrom'
import { DisplayCard } from './DisplayCard'
import { Keypad } from './Keypad'

/** The one screen: a header, the display card and the keypad, in one column. */
export function Calculator() {
  const { state, press } = useCalculator()
  const settledFrom = useSettledFrom(state)
  useKeyboard(press)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-4 p-4">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-[17px] font-semibold">Calculator</h1>
        <p className="text-[13px] text-muted">Exact decimals</p>
      </header>
      <DisplayCard model={displayModel(state, settledFrom)} />
      <Keypad onPress={press} />
    </main>
  )
}
