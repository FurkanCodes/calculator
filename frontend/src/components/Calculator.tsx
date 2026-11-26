import { displayModel } from '../calculator/display'
import { useCalculator } from '../hooks/useCalculator'
import { useKeyboard } from '../hooks/useKeyboard'
import { DisplayCard } from './DisplayCard'
import { Keypad } from './Keypad'

export function Calculator() {
  const { state, press } = useCalculator()
  useKeyboard(press)

  return (
    // Capped at 680 px, where the keys reach their 60 px maximum. On a short
    // screen the keypad shrinks before the page scrolls.
    <section
      aria-labelledby="calculator-title"
      className="mx-auto flex h-dvh max-h-[680px] w-full max-w-[420px] flex-col gap-4 p-4 [@media(max-height:600px)]:gap-3 [@media(max-height:600px)]:p-3"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h1 id="calculator-title" className="text-[17px] font-semibold">
          Calculator
        </h1>
        <p className="flex gap-3 text-[13px] text-muted">
          Exact decimals
          {/* The docs sit below the calculator on narrow screens. */}
          <a href="#about" className="link lg:hidden">
            About
          </a>
        </p>
      </header>
      <DisplayCard model={displayModel(state)} />
      <Keypad onPress={press} />
    </section>
  )
}
