import type { BinaryOperation, CalculateOutcome, CalculationRequest } from '../api/client'
import { isValidNumber } from '../validation/number'

// The calculator's state machine (docs/frontend-design.md). The reducer is
// pure: it does no arithmetic and no fetching. Entering Calculating is the
// signal to send state.request; useCalculator does that and dispatches
// 'settled' with the outcome.

/** The operator keys. percentage has its own key, %, with its own rules. */
export type Operator = Exclude<BinaryOperation, 'percentage'>

export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/**
 * A number on the display. A typed number is edited key by key, and may end
 * in a decimal point while it is typed. A result came from the backend; its
 * exact flag is false when the backend rounded it.
 */
export type Shown =
  | { origin: 'typed'; text: string }
  | { origin: 'result'; text: string; exact: boolean }
export type Typed = Extract<Shown, { origin: 'typed' }>
export type Result = Extract<Shown, { origin: 'result' }>

/** A request that finished without a result. */
export type Failure = Exclude<CalculateOutcome, { kind: 'success' }>

/** Where a successful result goes once its request returns. */
export type ResultTarget =
  /** After =, √, or % on the first number: show it. */
  | { to: 'ShowingResult' }
  /** After an operator: the result is the first number, with that operator chosen. */
  | { to: 'OperatorChosen'; operator: Operator }
  /** After % on the second number: the result replaces the second number. */
  | { to: 'EnteringSecond'; first: Shown; operator: Operator }

/** A request and where its result goes. */
export interface Calculation {
  request: CalculationRequest
  target: ResultTarget
}

/**
 * ShowingResult and Error keep the calculation they answer, so the display
 * can show it (`1 ÷ 3 =`). A result changed by the sign key is a new state
 * without one: the calculation no longer describes it.
 */
export type State =
  | { status: 'EnteringFirst'; first: Typed }
  | { status: 'OperatorChosen'; first: Shown; operator: Operator }
  | { status: 'EnteringSecond'; first: Shown; operator: Operator; second: Shown }
  /**
   * shown is the number on the display when the request was sent, as it was
   * sent: a typed 5. is 5. pending holds the keys pressed since, in order.
   */
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
  /** Sent by useCalculator when a request returns. It settles only the request it names. */
  | { type: 'settled'; request: CalculationRequest; outcome: CalculateOutcome }

/** The actions a person can send: every key on the keypad. */
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
        // The answer to any other request is ignored.
        return action.request === state.request ? settle(state, action.outcome) : state
      }
      // A key pressed before the answer waits for it, so typing fast gives
      // the same result as typing slowly. The request stays the same object.
      return { ...state, pending: [...(state.pending ?? []), action] }
    case 'Error':
      // An entry key starts a new first number; everything else is ignored.
      return isEntryKey(action) ? showFirst(applyEntryKey(ZERO, action)) : state
  }
}

/** EnteringFirst and ShowingResult: the shown number is the first operand. */
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
    // A second operator key corrects the first one.
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
 * The state after the answer, with the keys pressed while waiting applied in
 * order. After a failure they are dropped: they were meant for a number that
 * never came, and the error stays on the display.
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

/** The state for a first number: EnteringFirst while typed, ShowingResult for a result. */
function showFirst(shown: Shown): State {
  return shown.origin === 'typed'
    ? { status: 'EnteringFirst', first: shown }
    : { status: 'ShowingResult', result: shown }
}

function isEntryKey(action: Action): action is EntryKey {
  return action.type === 'digit' || action.type === 'decimalPoint' || action.type === 'toggleSign'
}

/**
 * Applies a digit, decimal point or sign key to the shown number, and returns
 * the same object when the key changes nothing.
 * - On a result, a digit or the decimal point starts a new typed number from
 *   0, and the sign key negates the result and keeps its exact flag.
 * - On a typed number, the key edits it. A key that would make it an invalid
 *   operand, such as a second decimal point or a 257th character, is ignored.
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

/** Negates a result by toggling its minus sign. Zero has no sign, so it stays as it is. */
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

/** The shown number as an operand: a typed 5. is sent as 5. */
function finished(shown: Shown): Shown {
  return shown.origin === 'typed' && shown.text.endsWith('.')
    ? { origin: 'typed', text: shown.text.slice(0, -1) }
    : shown
}
