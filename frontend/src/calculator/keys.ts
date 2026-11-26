import type { Digit, Key } from './reducer'

// One table drives both the keypad and the keyboard map.

export type KeyKind = 'digit' | 'function' | 'operator' | 'equals'

export interface KeySpec {
  label: string
  /** The y of xʸ. */
  superscript?: string
  /** Accessible name, for keys labelled with a symbol. */
  name?: string
  key: Key
  kind: KeyKind
  /** The `KeyboardEvent.key` values that press it. */
  keyboard?: readonly string[]
}

const digit = (d: Digit): KeySpec => ({ label: d, key: { type: 'digit', digit: d }, kind: 'digit', keyboard: [d] })

/** Row by row. No Backspace, because the reducer has no action that deletes a character. */
export const KEYS: readonly KeySpec[] = [
  { label: 'C', name: 'Clear', key: { type: 'clear' }, kind: 'function', keyboard: ['Escape', 'Delete'] },
  { label: '√', name: 'Square root', key: { type: 'squareRoot' }, kind: 'function' },
  {
    label: 'x',
    superscript: 'y',
    name: 'Power',
    key: { type: 'operator', operator: 'power' },
    kind: 'function',
    keyboard: ['^'],
  },
  { label: '%', name: 'Percent', key: { type: 'percent' }, kind: 'function', keyboard: ['%'] },
  digit('7'),
  digit('8'),
  digit('9'),
  { label: '÷', name: 'Divide', key: { type: 'operator', operator: 'divide' }, kind: 'operator', keyboard: ['/'] },
  digit('4'),
  digit('5'),
  digit('6'),
  { label: '×', name: 'Multiply', key: { type: 'operator', operator: 'multiply' }, kind: 'operator', keyboard: ['*'] },
  digit('1'),
  digit('2'),
  digit('3'),
  { label: '−', name: 'Subtract', key: { type: 'operator', operator: 'subtract' }, kind: 'operator', keyboard: ['-'] },
  { label: '±', name: 'Change sign', key: { type: 'toggleSign' }, kind: 'digit' },
  digit('0'),
  { label: '.', name: 'Decimal point', key: { type: 'decimalPoint' }, kind: 'digit', keyboard: ['.'] },
  { label: '+', name: 'Add', key: { type: 'operator', operator: 'add' }, kind: 'operator', keyboard: ['+'] },
  { label: '=', name: 'Equals', key: { type: 'equals' }, kind: 'equals', keyboard: ['Enter', '='] },
]

const BY_KEYBOARD = new Map(KEYS.flatMap((spec) => (spec.keyboard ?? []).map((name) => [name, spec.key] as const)))

export function keyAction(key: string): Key | null {
  return BY_KEYBOARD.get(key) ?? null
}

/** Enter on a focused button or link is left to the browser, which activates it. */
export function isCalculatorKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing) {
    return false
  }
  // AltGr reports Ctrl and Alt on Windows; characters typed with it still count.
  if ((event.ctrlKey || event.metaKey || event.altKey) && !event.getModifierState('AltGraph')) {
    return false
  }
  const target = event.target
  if (!(target instanceof Element)) {
    return true
  }
  if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) {
    return false
  }
  return !(event.key === 'Enter' && target.closest('button, a[href]'))
}
