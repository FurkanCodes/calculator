import type { Digit, Key } from './calculator'

const DIGITS = new Set<string>(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])

const KEYS = new Map<string, Key>([
  ['.', { type: 'decimalPoint' }],
  ['+', { type: 'operator', operator: 'add' }],
  ['-', { type: 'operator', operator: 'subtract' }],
  ['*', { type: 'operator', operator: 'multiply' }],
  ['/', { type: 'operator', operator: 'divide' }],
  ['^', { type: 'operator', operator: 'power' }],
  ['%', { type: 'percent' }],
  ['Enter', { type: 'equals' }],
  ['=', { type: 'equals' }],
  ['Escape', { type: 'clear' }],
  ['Delete', { type: 'clear' }],
])

/**
 * The keyboard map from docs/frontend-design.md: `KeyboardEvent.key` to the
 * action it sends, or null. There is no Backspace: the reducer has no action
 * that deletes one character.
 */
export function keyAction(key: string): Key | null {
  if (DIGITS.has(key)) {
    return { type: 'digit', digit: key as Digit }
  }
  return KEYS.get(key) ?? null
}

/**
 * Whether a keydown belongs to the calculator. It leaves alone keys typed
 * into another input, browser and system shortcuts, and Enter or Space on a
 * focused control, which the control itself handles.
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
