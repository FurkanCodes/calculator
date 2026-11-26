import type { BinaryOperation, CalculateOutcome, CalculationRequest } from '../api/client'
import { isValidNumber } from '../validation/number'

// The state machine from docs/frontend-design.md. It stays pure and does no
// arithmetic. Entering Calculating tells useCalculator to send state.request,
// and the hook dispatches 'settled' with the outcome.

/** percentage is left out because % has its own rules. */
export type Operator = Exclude<BinaryOperation, 'percentage'>

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/** A typed number may end in a decimal point mid-entry. A result is exact unless the backend rounded it. */
export type Shown =
  | { origin: 'typed'; text: string }
  | { origin: 'result'; text: string; exact: boolean }
export type Typed = Extract<Shown, { origin: 'typed' }>
export type Result = Extract<Shown, { origin: 'result' }>

export type Failure = Exclude<CalculateOutcome, { kind: 'success' }>

export type ResultTarget =
  /** After =, √, or % on the first number. */
  | { to: 'ShowingResult' }
  /** After an operator. The result becomes the first number. */
  | { to: 'OperatorChosen'; operator: Operator }
  /** After % on the second number, which the result replaces. */
  | { to: 'EnteringSecond'; first: Shown; operator: Operator }

export interface Calculation {
  request: CalculationRequest
  target: ResultTarget
}

/**
 * ShowingResult and Error keep their calculation for the expression line.
 * Negating a result drops it, because it no longer describes the number.
 */
export type State =
  | { status: 'EnteringFirst'; first: Typed }
  | { status: 'OperatorChosen'; first: Shown; operator: Operator }
  | { status: 'EnteringSecond'; first: Shown; operator: Operator; second: Shown }
  /** shown is the number as sent (a typed 5. is 5). pending is the keys pressed since. */
  | ({ status: 'Calculating'; shown: Shown; pending?: readonly Key[] } & Calculation)
  | { status: 'ShowingResult'; result: Result; calculation?: Calculation }
  | { status: 'Error'; failure: Failure; calculation: Calculation }

export type EntryKey = { type: 'digit'; digit: Digit } | { type: 'decimalPoint' } | { type: 'toggleSign' }

export type Action =
  | EntryKey
  | { type: 'operator'; operator: Operator }
  | { type: 'squareRoot' }
  | { type: 'percent' }
  | { type: 'equals' }
  | { type: 'clear' }
  /** Sent by useCalculator when a request returns. */
  | { type: 'settled'; request: CalculationRequest; outcome: CalculateOutcome }

export type Key = Exclude<Action, { type: 'settled' }>

const ZERO: Typed = { origin: 'typed', text: '0' }

export const initialState: State = { status: 'EnteringFirst', first: ZERO }

export function reducer(state: State, action: Action): State {
  if (action.type === 'clear') {
    // Leaving Calculating is what cancels its request (see useCalculator).
    return initialState
  }
  switch (state.status) {
    case 'EnteringFirst':
      return onFirstNumber(state, state.first, action)
    case 'ShowingResult':
      return onFirstNumber(state, state.result, action)
    case 'OperatorChosen':
      return operatorChosen(state, action)
    case 'EnteringSecond':
      return enteringSecond(state, action)
    case 'Calculating':
      if (action.type === 'settled') {
        // Matched by identity, so a late answer to a cleared request is ignored.
        return action.request === state.request ? settle(state, action.outcome) : state
      }
      // Keys wait for the answer, so typing fast gives the same result as typing
      // slowly. Keep the request object, or useCalculator would send it again.
      return { ...state, pending: [...(state.pending ?? []), action] }
    case 'Error':
      // Apart from Clear, only an entry key leaves the error, by starting a new number.
      return isEntryKey(action) ? showFirst(applyEntryKey(ZERO, action)) : state
  }
}

/** Shared by EnteringFirst and ShowingResult, where the shown number is the first operand. */
function onFirstNumber(state: State, shown: Shown, action: Action): State {
  if (isEntryKey(action)) {
    const next = applyEntryKey(shown, action)
    return next === shown ? state : showFirst(next)
  }
  const value = finished(shown)
  switch (action.type) {
    case 'operator':
      return { status: 'OperatorChosen', first: value, operator: action.operator }
    case 'squareRoot':
      return calculating(value, { operation: 'sqrt', operands: [value.text] }, { to: 'ShowingResult' })
    case 'percent':
      // With no operator chosen, x % is x% of 1, which is x ÷ 100.
      return calculating(
        value,
        { operation: 'percentage', operands: [value.text, '1'] },
        { to: 'ShowingResult' },
      )
    default:
      return state
  }
}

function operatorChosen(state: Extract<State, { status: 'OperatorChosen' }>, action: Action): State {
  if (isEntryKey(action)) {
    const { first, operator } = state
    return { status: 'EnteringSecond', first, operator, second: applyEntryKey(ZERO, action) }
  }
  if (action.type === 'operator') {
    // Another operator replaces the first.
    return { ...state, operator: action.operator }
  }
  return state
}

function enteringSecond(state: Extract<State, { status: 'EnteringSecond' }>, action: Action): State {
  if (isEntryKey(action)) {
    const second = applyEntryKey(state.second, action)
    return second === state.second ? state : { ...state, second }
  }
  const { first, operator } = state
  const second = finished(state.second)
  const a = finished(first).text
  const b = second.text
  switch (action.type) {
    case 'equals':
      return calculating(second, { operation: operator, operands: [a, b] }, { to: 'ShowingResult' })
    case 'operator':
      return calculating(
        second,
        { operation: operator, operands: [a, b] },
        { to: 'OperatorChosen', operator: action.operator },
      )
    case 'percent':
      // 50 + 10 % sends 10% of 50, and the 5 it returns replaces the 10.
      return calculating(
        second,
        { operation: 'percentage', operands: [b, a] },
        { to: 'EnteringSecond', first, operator },
      )
    default:
      return state
  }
}

/**
 * Replays the keys pressed while waiting. After a failure they are dropped,
 * since the number they were meant for never came.
 */
function settle(state: Extract<State, { status: 'Calculating' }>, outcome: CalculateOutcome): State {
  const next = answered(state, outcome)
  if (next.status === 'Error') {
    return next
  }
  return (state.pending ?? []).reduce<State>((s, key) => reducer(s, key), next)
}

function answered({ request, target }: Calculation, outcome: CalculateOutcome): State {
  const calculation: Calculation = { request, target }
  if (outcome.kind !== 'success') {
    return { status: 'Error', failure: outcome, calculation }
  }
  const result: Result = { origin: 'result', text: outcome.result, exact: outcome.exact }
  switch (target.to) {
    case 'ShowingResult':
      return { status: 'ShowingResult', result, calculation }
    case 'OperatorChosen':
      return { status: 'OperatorChosen', first: result, operator: target.operator }
    case 'EnteringSecond':
      return { status: 'EnteringSecond', first: target.first, operator: target.operator, second: result }
  }
}

function calculating(shown: Shown, request: CalculationRequest, target: ResultTarget): State {
  return { status: 'Calculating', request, target, shown }
}

function showFirst(shown: Shown): State {
  return shown.origin === 'typed'
    ? { status: 'EnteringFirst', first: shown }
    : { status: 'ShowingResult', result: shown }
}

function isEntryKey(action: Action): action is EntryKey {
  return action.type === 'digit' || action.type === 'decimalPoint' || action.type === 'toggleSign'
}

/**
 * Returns the same object when the key changes nothing. On a result, ± negates
 * it and keeps its exact flag, and any other key starts a new number. A key
 * that would make a typed number invalid, such as a second point, is ignored.
 */
export function applyEntryKey(shown: Shown, key: EntryKey): Shown {
  if (shown.origin === 'result') {
    if (key.type !== 'toggleSign') {
      return applyEntryKey(ZERO, key)
    }
    const text = negate(shown.text)
    return text === shown.text ? shown : { ...shown, text }
  }
  const text = editTyped(shown.text, key)
  return text === shown.text ? shown : { origin: 'typed', text }
}

function editTyped(text: string, key: EntryKey): string {
  let next: string
  switch (key.type) {
    case 'digit':
      // A digit replaces a lone zero: 0 then 5 is 5, and -0 then 5 is -5.
      next = text === '0' || text === '-0' ? `${text.slice(0, -1)}${key.digit}` : `${text}${key.digit}`
      break
    case 'decimalPoint':
      next = `${text}.`
      break
    case 'toggleSign':
      // On a typed 0 this gives -0, so a negative number can be typed sign first.
      next = toggleMinus(text)
      break
  }
  // A typed number ending in a decimal point is valid if a digit could follow it.
  return isValidNumber(next.endsWith('.') ? `${next}0` : next) ? next : text
}

/** Zero has no sign, so it stays as it is. */
function negate(text: string): string {
  if (!/[1-9]/.test(text)) {
    return text
  }
  const next = toggleMinus(text)
  return isValidNumber(next) ? next : text
}

function toggleMinus(text: string): string {
  return text.startsWith('-') ? text.slice(1) : `-${text}`
}

/** A typed 5. is sent as 5. */
function finished(shown: Shown): Shown {
  return shown.origin === 'typed' && shown.text.endsWith('.')
    ? { origin: 'typed', text: shown.text.slice(0, -1) }
    : shown
}
