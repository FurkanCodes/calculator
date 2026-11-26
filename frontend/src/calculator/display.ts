import type { Calculation, Operator, Shown, State } from './reducer'
import { type FailureText, failureText } from './messages'

// Everything the display shows, derived from the reducer's state. The
// components read only this model, never the state itself.

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
      /** True while a request is in flight: the number is the one it was sent with. */
      dimmed: boolean
      /** A finished result, which the Copy button offers. */
      copyable: boolean
      /**
       * Which end stays in view when the text is too long to fit: the end of
       * a typed number, where digits are added, or the leading digits of a result.
       */
      anchor: 'start' | 'end'
    }
  | ({ kind: 'failure' } & FailureText)

export interface DisplayModel {
  /** The line above the value, such as `50 +` or `1 ÷ 3 =`. Empty when there is nothing to show. */
  expression: string
  value: ValueModel
}

export function displayModel(state: State): DisplayModel {
  switch (state.status) {
    case 'EnteringFirst':
      return { expression: '', value: number(state.first) }
    case 'OperatorChosen':
      return { expression: pending(state.first, state.operator), value: number(state.first) }
    case 'EnteringSecond':
      return { expression: pending(state.first, state.operator), value: number(state.second) }
    case 'Calculating':
      return { expression: describe(state), value: number(state.shown, { dimmed: true }) }
    case 'ShowingResult':
      return {
        expression: state.calculation ? describe(state.calculation) : '',
        value: number(state.result, { copyable: true }),
      }
    case 'Error':
      return { expression: describe(state.calculation), value: { kind: 'failure', ...failureText(state.failure) } }
  }
}

function number(shown: Shown, { dimmed = false, copyable = false } = {}): ValueModel {
  const typed = shown.origin === 'typed'
  return {
    kind: 'number',
    text: shown.text,
    exact: typed || shown.exact,
    dimmed,
    copyable,
    anchor: typed ? 'end' : 'start',
  }
}

/** The first number and its operator. The reducer has already dropped a typed trailing point from it. */
function pending(first: Shown, operator: Operator): string {
  return `${first.text} ${OPERATOR_SYMBOLS[operator]}`
}

/**
 * The calculation in the user's terms: `50 + 10`, `√9`, `10%`, or `50 + 10%`
 * for % on a second number. It ends in `=` when its result is shown; when an
 * operator or % started it, the result goes back into the next entry instead.
 */
export function describe({ request, target }: Calculation): string {
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
