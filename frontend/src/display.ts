import type { Operator, Shown, State } from './calculator'
import { type FailureText, failureText } from './errors'

// Everything the display shows, derived from the reducer's state. The
// components read only this model, never the state itself.

export type Calculating = Extract<State, { status: 'Calculating' }>

export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
}

export type ValueModel =
  | {
      kind: 'number'
      text: string
      /** False marks a rounded result from the backend. */
      exact: boolean
      /** A finished result, which the Copy button offers. */
      copyable: boolean
      /**
       * Which end stays in view when the text is too long to fit: the end
       * where digits are being typed, or the leading digits of a result.
       */
      anchor: 'start' | 'end'
    }
  /** The number shown when the request was sent, dimmed while it is in flight. */
  | { kind: 'calculating'; text: string }
  | ({ kind: 'failure' } & FailureText)

export interface DisplayModel {
  /** The line above the value, such as `50 +` or `1 ÷ 3 =`. Empty when there is nothing to show. */
  expression: string
  value: ValueModel
}

/**
 * The display for a state. `settledFrom` is the Calculating state that this
 * state is the answer to, if it is one (see useSettledFrom): a result or an
 * error then shows the calculation it answers, such as `1 ÷ 3 =`.
 */
export function displayModel(state: State, settledFrom: Calculating | null): DisplayModel {
  switch (state.status) {
    case 'EnteringFirst':
      return { expression: '', value: number(state.first, false) }
    case 'OperatorChosen':
      return { expression: pending(state.first, state.operator), value: number(state.first, false) }
    case 'EnteringSecond':
      return { expression: pending(state.first, state.operator), value: number(state.second, false) }
    case 'Calculating':
      return { expression: describe(state), value: { kind: 'calculating', text: state.shown.text } }
    case 'ShowingResult':
      return { expression: settledFrom ? describe(settledFrom) : '', value: number(state.result, true) }
    case 'Error':
      return {
        expression: settledFrom ? describe(settledFrom) : '',
        value: { kind: 'failure', ...failureText(state.failure) },
      }
  }
}

function number(shown: Shown, copyable: boolean): ValueModel {
  const typed = shown.origin === 'typed'
  return {
    kind: 'number',
    text: shown.text,
    exact: typed || shown.exact,
    copyable,
    anchor: typed ? 'end' : 'start',
  }
}

function pending(first: Shown, operator: Operator): string {
  return `${operand(first)} ${OPERATOR_SYMBOLS[operator]}`
}

/** A typed 5. is sent as 5, so the expression writes it that way too. */
function operand(shown: Shown): string {
  return shown.origin === 'typed' && shown.text.endsWith('.') ? shown.text.slice(0, -1) : shown.text
}

/**
 * The calculation in the user's terms: `50 + 10`, `√9`, `10%`, or `50 + 10%`
 * for % on a second number. It ends in `=` when its result is shown; when an
 * operator or % started it, the result goes back into the next entry instead.
 */
export function describe({ request, target }: Pick<Calculating, 'request' | 'target'>): string {
  const [a = '', b = ''] = request.operands
  let text: string
  if (request.operation === 'sqrt') {
    text = `√${a}`
  } else if (request.operation === 'percentage') {
    // % on the second number sends percentage(second, first).
    text = target.to === 'EnteringSecond' ? `${pending(target.first, target.operator)} ${a}%` : `${a}%`
  } else {
    text = `${a} ${OPERATOR_SYMBOLS[request.operation]} ${b}`
  }
  return target.to === 'ShowingResult' ? `${text} =` : text
}
