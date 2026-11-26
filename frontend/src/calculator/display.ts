import type { Calculation, Operator, Shown, State } from './reducer'
import { type FailureText, failureText } from './messages'

// Derived from the reducer's state. Components read only this model.

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
      /** False when the backend rounded the result. */
      exact: boolean
      /** A request is in flight. The number is the one it was sent with. */
      dimmed: boolean
      copyable: boolean
      /** The end kept in view on overflow. Typed numbers grow at the end; results read from the start. */
      anchor: 'start' | 'end'
    }
  | ({ kind: 'failure' } & FailureText)

export interface DisplayModel {
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

/** The reducer has already dropped a typed trailing point from first. */
function pending(first: Shown, operator: Operator): string {
  return `${first.text} ${OPERATOR_SYMBOLS[operator]}`
}

/**
 * The calculation as the user typed it, such as `50 + 10%`. It ends in `=`
 * when the result is the answer. After an operator or %, the result goes
 * into the next entry.
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
