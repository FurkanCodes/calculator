import type { Digit, Key } from '../calculator'

type KeyKind = 'digit' | 'function' | 'operator' | 'equals'

interface KeySpec {
  label: string
  /** What the key shows, when that is not just its label. */
  content?: React.ReactNode
  /** For keys whose label is a symbol rather than a word or digit. */
  name?: string
  action: Key
  kind: KeyKind
}

const digit = (d: Digit): KeySpec => ({
  label: d,
  action: { type: 'digit', digit: d },
  kind: 'digit',
})

/** The keypad from docs/frontend-design.md, row by row. */
export const KEYS: KeySpec[] = [
  { label: 'C', name: 'Clear', action: { type: 'clear' }, kind: 'function' },
  { label: '√', name: 'Square root', action: { type: 'squareRoot' }, kind: 'function' },
  {
    label: 'xʸ',
    // The modifier letter ʸ takes a whole monospace cell, so x and y drift apart.
    content: (
      <>
        x<sup className="text-[0.6em]">y</sup>
      </>
    ),
    name: 'Power',
    action: { type: 'operator', operator: 'power' },
    kind: 'function',
  },
  { label: '%', name: 'Percent', action: { type: 'percent' }, kind: 'function' },
  digit('7'),
  digit('8'),
  digit('9'),
  { label: '÷', name: 'Divide', action: { type: 'operator', operator: 'divide' }, kind: 'operator' },
  digit('4'),
  digit('5'),
  digit('6'),
  { label: '×', name: 'Multiply', action: { type: 'operator', operator: 'multiply' }, kind: 'operator' },
  digit('1'),
  digit('2'),
  digit('3'),
  { label: '−', name: 'Subtract', action: { type: 'operator', operator: 'subtract' }, kind: 'operator' },
  { label: '±', name: 'Change sign', action: { type: 'toggleSign' }, kind: 'digit' },
  digit('0'),
  { label: '.', name: 'Decimal point', action: { type: 'decimalPoint' }, kind: 'digit' },
  { label: '+', name: 'Add', action: { type: 'operator', operator: 'add' }, kind: 'operator' },
  { label: '=', name: 'Equals', action: { type: 'equals' }, kind: 'equals' },
]

const KIND_CLASSES: Record<KeyKind, string> = {
  digit: 'border-hairline bg-surface text-ink',
  function: 'border-function-key-border bg-function-key text-ink',
  operator: 'border-operator-key-border bg-operator-key text-accent',
  equals: 'col-span-4 border-accent bg-accent text-surface',
}

export function Keypad({ onPress }: { onPress: (action: Key) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {KEYS.map((key) => (
        <button
          key={key.label}
          type="button"
          aria-label={key.name}
          className={`focus-ring h-15 rounded-[10px] border font-mono text-[22px] select-none transition-[filter] duration-100 hover:brightness-[.97] active:brightness-[.92] ${KIND_CLASSES[key.kind]}`}
          // A mouse or touch press keeps focus where it was, so Enter on the
          // keyboard still means equals rather than pressing this key again.
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            onPress(key.action)
          }}
        >
          {key.content ?? key.label}
        </button>
      ))}
    </div>
  )
}
