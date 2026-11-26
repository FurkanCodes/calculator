import type { Digit, Key } from './reducer'

// The calculator's keys: one table for the keypad and the keyboard map
// (docs/frontend-design.md).

export type KeyKind = 'digit' | 'function' | 'operator' | 'equals'

export interface KeySpec {
  /** What the key shows. */
  label: string
  /** Shown raised after the label: the y of xʸ. */
  superscript?: string
  /** The accessible name, for keys whose label is a symbol rather than a word or digit. */
  name?: string
  key: Key
  kind: KeyKind
  /** The `KeyboardEvent.key` values that press it. */
  keyboard?: readonly string[]
}

const digit = (d: Digit): KeySpec => ({ label: d, key: { type: 'digit', digit: d }, kind: 'digit', keyboard: [d] })

/**
 * The keypad, row by row. There is no Backspace: the reducer has no action
 * that deletes one character.
 */
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

/** The key a `KeyboardEvent.key` presses, or null. */
export function keyAction(key: string): Key | null {
  return BY_KEYBOARD.get(key) ?? null
}

/**
 * Whether a keydown belongs to the calculator. It leaves alone keys typed
 * into another input, browser and system shortcuts, and Enter on a focused
 * button or link, which activates it.
 */
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
