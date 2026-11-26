import type { BinaryOperation, CalculateOutcome, CalculationRequest } from './api'
import { isValidNumber } from './number'

// The calculator's state machine (docs/frontend-design.md). The reducer is
// pure: it does no arithmetic and no fetching. Entering Calculating is the
// signal to send state.request; useCalculator does that and dispatches
// 'settled' with the outcome.

/** The operator keys. percentage has its own key, %, with its own rules. */
export type Operator = Exclude<BinaryOperation, 'percentage'>

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/** A request that finished without a result. */
export type Failure = Extract<CalculateOutcome, { kind: 'error' | 'unreachable' }>

/** Every outcome but 'aborted', which belongs to a request nobody waits for. */
export type Settled = Exclude<CalculateOutcome, { kind: 'aborted' }>

/** Where a successful result goes once its request returns. */
export type ResultTarget =
  /** After =, √, or % on the first number: show it. */
  | { to: 'ShowingResult' }
  /** After an operator: the result is the first number, with that operator chosen. */
  | { to: 'OperatorChosen'; operator: Operator }
  /** After % on the second number: the result replaces the second number. */
  | { to: 'EnteringSecond'; first: string; operator: Operator }

/**
 * An entry is the number being typed. It may end in a decimal point, which is
 * dropped when the entry is used as an operand. `exact` is false only while
 * the number shown is a rounded result from the backend.
 */
export type State =
  | { status: 'EnteringFirst'; entry: string }
  | { status: 'OperatorChosen'; first: string; operator: Operator; exact: boolean }
  | { status: 'EnteringSecond'; first: string; operator: Operator; entry: string; exact: boolean }
  | { status: 'Calculating'; request: CalculationRequest; target: ResultTarget }
  | { status: 'ShowingResult'; result: string; exact: boolean }
  | { status: 'Error'; failure: Failure }

export type Action =
  | { type: 'digit'; digit: Digit }
  | { type: 'decimalPoint' }
  | { type: 'toggleSign' }
  | { type: 'operator'; operator: Operator }
  | { type: 'squareRoot' }
  | { type: 'percent' }
  | { type: 'equals' }
  | { type: 'clear' }
  /** Sent by useCalculator when the request for Calculating returns. */
  | { type: 'settled'; outcome: Settled }

type EntryAction = Extract<Action, { type: 'digit' | 'decimalPoint' | 'toggleSign' }>

export const initialState: State = { status: 'EnteringFirst', entry: '0' }

export function reducer(state: State, action: Action): State {
  if (action.type === 'clear') {
    // Leaving Calculating is what cancels its request (see useCalculator).
    return initialState
  }
  switch (state.status) {
    case 'EnteringFirst':
      return enteringFirst(state, action)
    case 'OperatorChosen':
      return operatorChosen(state, action)
    case 'EnteringSecond':
      return enteringSecond(state, action)
    case 'Calculating':
      // Every other key is ignored until the request returns.
      return action.type === 'settled' ? settle(state.target, action.outcome) : state
    case 'ShowingResult':
      return showingResult(state, action)
    case 'Error':
      return isEntryAction(action) ? newEntry(action) : state
  }
}

function enteringFirst(state: Extract<State, { status: 'EnteringFirst' }>, action: Action): State {
  if (isEntryAction(action)) {
    const entry = editEntry(state.entry, action)
    return entry === state.entry ? state : { ...state, entry }
  }
  const value = toOperand(state.entry)
  switch (action.type) {
    case 'operator':
      return { status: 'OperatorChosen', first: value, operator: action.operator, exact: true }
    case 'squareRoot':
      return squareRoot(value)
    case 'percent':
      return percentOfFirst(value)
    default:
      return state
  }
}

function operatorChosen(state: Extract<State, { status: 'OperatorChosen' }>, action: Action): State {
  if (isEntryAction(action)) {
    const { first, operator } = state
    return { status: 'EnteringSecond', first, operator, entry: editEntry('0', action), exact: true }
  }
  if (action.type === 'operator') {
    // A second operator key corrects the first one.
    return { ...state, operator: action.operator }
  }
  return state
}

function enteringSecond(state: Extract<State, { status: 'EnteringSecond' }>, action: Action): State {
  if (isEntryAction(action)) {
    const entry = editEntry(state.entry, action)
    // Typing makes the number the user's own; changing its sign keeps a
    // rounded result rounded.
    const exact = action.type === 'toggleSign' ? state.exact : true
    return entry === state.entry ? state : { ...state, entry, exact }
  }
  const { first, operator } = state
  const second = toOperand(state.entry)
  const request: CalculationRequest = { operation: operator, operands: [first, second] }
  switch (action.type) {
    case 'equals':
      return calculating(request, { to: 'ShowingResult' })
    case 'operator':
      return calculating(request, { to: 'OperatorChosen', operator: action.operator })
    case 'percent':
      // 50 + 10 % sends 10% of 50, and the 5 it returns replaces the 10.
      return calculating(
        { operation: 'percentage', operands: [second, first] },
        { to: 'EnteringSecond', first, operator },
      )
    default:
      return state
  }
}

function showingResult(state: Extract<State, { status: 'ShowingResult' }>, action: Action): State {
  if (isEntryAction(action)) {
    return newEntry(action)
  }
  switch (action.type) {
    case 'operator':
      return { status: 'OperatorChosen', first: state.result, operator: action.operator, exact: state.exact }
    case 'squareRoot':
      return squareRoot(state.result)
    case 'percent':
      return percentOfFirst(state.result)
    default:
      return state
  }
}

function settle(target: ResultTarget, outcome: Settled): State {
  if (outcome.kind !== 'success') {
    return { status: 'Error', failure: outcome }
  }
  const { result, exact } = outcome
  switch (target.to) {
    case 'ShowingResult':
      return { status: 'ShowingResult', result, exact }
    case 'OperatorChosen':
      return { status: 'OperatorChosen', first: result, operator: target.operator, exact }
    case 'EnteringSecond':
      return { status: 'EnteringSecond', first: target.first, operator: target.operator, entry: result, exact }
  }
}

function calculating(request: CalculationRequest, target: ResultTarget): State {
  return { status: 'Calculating', request, target }
}

function squareRoot(value: string): State {
  return calculating({ operation: 'sqrt', operands: [value] }, { to: 'ShowingResult' })
}

/** % with no operator chosen: value% of 1, which is value ÷ 100. */
function percentOfFirst(value: string): State {
  return calculating({ operation: 'percentage', operands: [value, '1'] }, { to: 'ShowingResult' })
}

/** After a result or an error, an entry key starts a new first number. */
function newEntry(action: EntryAction): State {
  return { status: 'EnteringFirst', entry: editEntry('0', action) }
}

function isEntryAction(action: Action): action is EntryAction {
  return action.type === 'digit' || action.type === 'decimalPoint' || action.type === 'toggleSign'
}

/**
 * Applies an entry key. A key that would make the entry an invalid operand,
 * such as a second decimal point or a 257th character, leaves it unchanged.
 */
export function editEntry(entry: string, action: EntryAction): string {
  const next = applyKey(entry, action)
  return isValidEntry(next) ? next : entry
}

function applyKey(entry: string, action: EntryAction): string {
  switch (action.type) {
    case 'digit':
      // A digit replaces a lone zero: 0 then 5 is 5, and -0 then 5 is -5.
      return entry === '0' || entry === '-0' ? `${entry.slice(0, -1)}${action.digit}` : `${entry}${action.digit}`
    case 'decimalPoint':
      return `${entry}.`
    case 'toggleSign':
      return entry.startsWith('-') ? entry.slice(1) : `-${entry}`
  }
}

/** An entry ending in a decimal point is valid if a digit could follow it. */
function isValidEntry(entry: string): boolean {
  return isValidNumber(entry.endsWith('.') ? `${entry}0` : entry)
}

/** The operand an entry stands for: 5. is sent as 5. */
function toOperand(entry: string): string {
  return entry.endsWith('.') ? entry.slice(0, -1) : entry
}
