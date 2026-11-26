import { describe, expect, it } from 'vitest'
import { isCalculatorKey, keyAction } from './keyboard'

describe('keyAction', () => {
  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])('types the digit %s', (key) => {
    expect(keyAction(key)).toEqual({ type: 'digit', digit: key })
  })

  it.each([
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
  ])('maps %s', (key, action) => {
    expect(keyAction(key)).toEqual(action)
  })

  it.each(['Backspace', 'a', 'x', ' ', 'Tab', 'F1', 'toString', 'constructor'])('ignores %j', (key) => {
    expect(keyAction(key)).toBeNull()
  })
})

function keydown(key: string, target: EventTarget, init: KeyboardEventInit = {}) {
  let result: boolean | undefined
  const listener = (event: Event) => {
    result = isCalculatorKey(event as KeyboardEvent)
  }
  window.addEventListener('keydown', listener)
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  window.removeEventListener('keydown', listener)
  return result
}

function element(html: string): HTMLElement {
  document.body.innerHTML = html
  return document.body.firstElementChild as HTMLElement
}

describe('isCalculatorKey', () => {
  it('takes keys aimed at the page', () => {
    expect(keydown('7', document.body)).toBe(true)
    expect(keydown('Enter', document.body)).toBe(true)
    expect(keydown('7', window)).toBe(true)
  })

  it.each(['<input>', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"></div>'])(
    'leaves keys typed into %s alone',
    (html) => {
      expect(keydown('7', element(html))).toBe(false)
    },
  )

  it('takes keys on an element whose editing is switched off', () => {
    expect(keydown('7', element('<div contenteditable="false"></div>'))).toBe(true)
  })

  it('leaves Enter on a focused button to the button, but takes other keys there', () => {
    const button = element('<button>7</button>')
    expect(keydown('Enter', button)).toBe(false)
    expect(keydown('7', button)).toBe(true)
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])('leaves shortcuts alone: %o', (init) => {
    expect(keydown('7', document.body, init)).toBe(false)
  })

  it('takes characters typed with AltGr, which reports Ctrl and Alt', () => {
    const event = new KeyboardEvent('keydown', { key: '^', ctrlKey: true, altKey: true })
    Object.defineProperty(event, 'getModifierState', { value: (key: string) => key === 'AltGraph' })
    expect(isCalculatorKey(event)).toBe(true)
  })

  it('leaves alone a key already handled, or one composing text', () => {
    const handled = new KeyboardEvent('keydown', { key: '7', cancelable: true })
    handled.preventDefault()
    expect(isCalculatorKey(handled)).toBe(false)
    expect(isCalculatorKey(new KeyboardEvent('keydown', { key: '7', isComposing: true }))).toBe(false)
  })
})
