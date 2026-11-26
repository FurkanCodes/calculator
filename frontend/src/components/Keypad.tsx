import type { Key } from '../calculator'
import { KEYS, type KeyKind } from '../keys'

const KIND_CLASSES: Record<KeyKind, string> = {
  digit: 'border-hairline bg-surface text-ink',
  function: 'border-function-key-border bg-function-key text-ink',
  operator: 'border-operator-key-border bg-operator-key text-accent',
  equals: 'col-span-4 border-accent bg-accent text-surface',
}

/**
 * The keypad: six rows that share the height left over by the display, each
 * between 44 px (the touch minimum) and 60 px.
 */
export function Keypad({ onPress }: { onPress: (key: Key) => void }) {
  return (
    <div className="grid min-h-[304px] shrink basis-[400px] grid-cols-4 grid-rows-[repeat(6,minmax(44px,1fr))] gap-2">
      {KEYS.map((spec) => (
        <button
          key={spec.name ?? spec.label}
          type="button"
          aria-label={spec.name}
          className={`focus-ring rounded-[10px] border font-mono text-[22px] select-none transition-[filter] duration-100 hover:brightness-[.97] active:brightness-[.92] ${KIND_CLASSES[spec.kind]}`}
          // A mouse or touch press keeps focus where it was, so Enter on the
          // keyboard still means equals rather than pressing this key again.
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            onPress(spec.key)
          }}
        >
          {spec.label}
          {spec.superscript && <sup className="text-[0.6em]">{spec.superscript}</sup>}
        </button>
      ))}
    </div>
  )
}
