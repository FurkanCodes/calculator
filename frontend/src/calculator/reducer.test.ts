import { describe, expect, it } from 'vitest'
import type { CalculateOutcome } from '../api/client'
import {
  type Action,
  applyEntryKey,
  type Calculation,
  type Digit,
  type EntryKey,
  initialState,
  reducer,
  type Result,
  type State,
  type Typed,
} from './reducer'

/** A function step answers the request in flight. */
type Step = Action | ((state: State) => State)

function run(state: State, ...steps: Step[]): State {
  return steps.reduce((s, step) => (typeof step === 'function' ? step(s) : reducer(s, step)), state)
}

/** Answers the request in flight, as useCalculator would. */
function answer(outcome: CalculateOutcome): Step {
  return (state) => {
    if (state.status !== 'Calculating') {
      throw new Error(`answer() needs Calculating, not ${state.status}`)
    }
    return reducer(state, { type: 'settled', request: state.request, outcome })
  }
}

const succeed = (text: string, exact = true) => answer({ kind: 'success', result: text, exact })

/** '-' stands for the sign key. */
function type(text: string): Action[] {
  return [...text].map((c): Action => {
    if (c === '.') return { type: 'decimalPoint' }
    if (c === '-') return { type: 'toggleSign' }
    return { type: 'digit', digit: c as Digit }
  })
}

const typed = (text: string): Typed => ({ origin: 'typed', text })
const result = (text: string, exact = true): Result => ({ origin: 'result', text, exact })

const digit = (d: Digit): Action => ({ type: 'digit', digit: d })
const decimalPoint: EntryKey = { type: 'decimalPoint' }
const toggleSign: EntryKey = { type: 'toggleSign' }
const add: Action = { type: 'operator', operator: 'add' }
const multiply: Action = { type: 'operator', operator: 'multiply' }
const equals: Action = { type: 'equals' }
const squareRoot: Action = { type: 'squareRoot' }
const percent: Action = { type: 'percent' }
const clear: Action = { type: 'clear' }

const ONE_THIRD = '0.3333333333333333333333333333333333'
const divisionByZero: CalculateOutcome = {
  kind: 'error',
  code: 'DIVISION_BY_ZERO',
  message: 'Cannot divide by zero.',
}

// One of each state, for the rules that hold in all of them.
const enteringFirst: State = { status: 'EnteringFirst', first: typed('12') }
const operatorChosen: State = { status: 'OperatorChosen', first: typed('12'), operator: 'add' }
const enteringSecond: State = {
  status: 'EnteringSecond',
  first: typed('12'),
  operator: 'add',
  second: typed('3'),
}
const addition: Calculation = {
  request: { operation: 'add', operands: ['12', '3'] },
  target: { to: 'ShowingResult' },
}
const calculating: State = { status: 'Calculating', ...addition, shown: typed('3') }
const showingResult: State = { status: 'ShowingResult', result: result('15'), calculation: addition }
const error: State = { status: 'Error', failure: { kind: 'unreachable' }, calculation: addition }

const everyState = { enteringFirst, operatorChosen, enteringSecond, calculating, showingResult, error }

describe('the state diagram', () => {
  it('starts in EnteringFirst with a typed 0', () => {
    expect(initialState).toEqual({ status: 'EnteringFirst', first: typed('0') })
  })

  it('EnteringFirst --operator--> OperatorChosen', () => {
    expect(run(enteringFirst, add)).toEqual(operatorChosen)
  })

  it('EnteringFirst --square root--> Calculating', () => {
    expect(run(enteringFirst, squareRoot)).toEqual({
      status: 'Calculating',
      request: { operation: 'sqrt', operands: ['12'] },
      target: { to: 'ShowingResult' },
      shown: typed('12'),
    })
  })

  it('EnteringFirst --%--> Calculating', () => {
    expect(run(enteringFirst, percent)).toMatchObject({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['12', '1'] },
    })
  })

  it('OperatorChosen --digit--> EnteringSecond', () => {
    expect(run(operatorChosen, digit('3'))).toEqual(enteringSecond)
  })

  it('EnteringSecond --equals--> Calculating', () => {
    expect(run(enteringSecond, equals)).toEqual(calculating)
  })

  it('EnteringSecond --operator--> Calculating, remembering the operator', () => {
    expect(run(enteringSecond, multiply)).toEqual({
      ...calculating,
      target: { to: 'OperatorChosen', operator: 'multiply' },
    })
  })

  it('EnteringSecond --%--> Calculating', () => {
    expect(run(enteringSecond, percent)).toEqual({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['3', '12'] },
      target: { to: 'EnteringSecond', first: typed('12'), operator: 'add' },
      shown: typed('3'),
    })
  })

  it('Calculating --result--> ShowingResult, keeping the exact flag and the calculation', () => {
    expect(run(calculating, succeed('15'))).toEqual(showingResult)
    expect(run(calculating, succeed(ONE_THIRD, false))).toEqual({
      status: 'ShowingResult',
      result: result(ONE_THIRD, false),
      calculation: addition,
    })
  })

  it('Calculating --result, after an operator--> OperatorChosen, with the result as the first number', () => {
    expect(run(enteringSecond, multiply, succeed(ONE_THIRD, false))).toEqual({
      status: 'OperatorChosen',
      first: result(ONE_THIRD, false),
      operator: 'multiply',
    })
  })

  it('Calculating --result, after %--> EnteringSecond, with the result as the second number', () => {
    expect(run(enteringSecond, percent, succeed('0.36'))).toEqual({
      ...enteringSecond,
      second: result('0.36'),
    })
  })

  it.each<[string, CalculateOutcome]>([
    ['an API error', divisionByZero],
    ['an error with an unknown code', { kind: 'error', code: null, message: 'New.' }],
    ['an invalid response', { kind: 'invalidResponse' }],
    ['no connection', { kind: 'unreachable' }],
  ])('Calculating --%s--> Error, keeping the calculation', (_name, outcome) => {
    expect(run(calculating, answer(outcome))).toEqual({ status: 'Error', failure: outcome, calculation: addition })
  })

  it('keeps the calculation of an operator- or %-started request on Error, with its target', () => {
    expect(run(enteringSecond, multiply, answer(divisionByZero))).toEqual({
      status: 'Error',
      failure: divisionByZero,
      calculation: { ...addition, target: { to: 'OperatorChosen', operator: 'multiply' } },
    })
    expect(run(enteringSecond, percent, answer(divisionByZero))).toEqual({
      status: 'Error',
      failure: divisionByZero,
      calculation: {
        request: { operation: 'percentage', operands: ['3', '12'] },
        target: { to: 'EnteringSecond', first: typed('12'), operator: 'add' },
      },
    })
  })

  it('ShowingResult --operator--> OperatorChosen, with the result as the first number', () => {
    const rounded: State = { status: 'ShowingResult', result: result(ONE_THIRD, false) }
    expect(run(rounded, multiply)).toEqual({
      status: 'OperatorChosen',
      first: result(ONE_THIRD, false),
      operator: 'multiply',
    })
  })

  it('ShowingResult --square root--> Calculating', () => {
    expect(run(showingResult, squareRoot)).toEqual({
      status: 'Calculating',
      request: { operation: 'sqrt', operands: ['15'] },
      target: { to: 'ShowingResult' },
      shown: result('15'),
    })
  })

  it('ShowingResult --%--> Calculating', () => {
    expect(run(showingResult, percent)).toEqual({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['15', '1'] },
      target: { to: 'ShowingResult' },
      shown: result('15'),
    })
  })

  it('ShowingResult --digit--> EnteringFirst, starting a new number', () => {
    expect(run(showingResult, digit('7'))).toEqual({ status: 'EnteringFirst', first: typed('7') })
  })

  it('Error --digit--> EnteringFirst, starting a new number', () => {
    expect(run(error, digit('7'))).toEqual({ status: 'EnteringFirst', first: typed('7') })
  })
})

describe('Clear', () => {
  it.each(Object.entries(everyState))('returns to EnteringFirst from %s', (_name, state) => {
    expect(reducer(state, clear)).toBe(initialState)
  })
})

describe('Calculating', () => {
  it.each<[string, Action]>([
    ['a digit', digit('1')],
    ['the decimal point', decimalPoint],
    ['the sign key', toggleSign],
    ['an operator', add],
    ['equals', equals],
    ['square root', squareRoot],
    ['percent', percent],
  ])('keeps %s until the answer, with the same request', (_name, action) => {
    const next = reducer(calculating, action)
    expect(next).toEqual({ ...calculating, pending: [action] })
    if (next.status !== 'Calculating' || calculating.status !== 'Calculating') throw new Error('expected Calculating')
    expect(next.request).toBe(calculating.request)
  })

  it('gives the same result for keys typed before an answer as after it', () => {
    // 2 + 3 × 4 =, typed before the answer to 2 + 3 arrives.
    const fast = run(initialState, digit('2'), add, digit('3'), multiply, digit('4'), equals, succeed('5'))
    expect(fast).toMatchObject({ status: 'Calculating', request: { operation: 'multiply', operands: ['5', '4'] } })
    expect(run(fast, succeed('20'))).toMatchObject({ status: 'ShowingResult', result: result('20') })
  })

  it('keeps keys typed during a replayed calculation for its own answer', () => {
    // 2 + 3 × 4 = × 2 =, all typed before the first answer.
    const state = run(
      initialState,
      ...[digit('2'), add, digit('3'), multiply, digit('4'), equals, multiply, digit('2'), equals],
      succeed('5'),
      succeed('20'),
    )
    expect(state).toMatchObject({ status: 'Calculating', request: { operation: 'multiply', operands: ['20', '2'] } })
    expect(run(state, succeed('40'))).toMatchObject({ status: 'ShowingResult', result: result('40') })
  })

  it('drops keys typed ahead of a failure, so the error stays on the display', () => {
    const state = run(calculating, digit('4'), add, answer(divisionByZero))
    expect(state).toEqual({ status: 'Error', failure: divisionByZero, calculation: addition })
  })

  it('drops keys typed ahead when Clear is pressed', () => {
    expect(run(calculating, digit('4'), add, clear)).toBe(initialState)
  })

  it('ignores the answer to a request that is no longer in flight', () => {
    const old = run(initialState, digit('2'), add, digit('3'), equals)
    if (old.status !== 'Calculating') throw new Error('expected Calculating')

    const current = run(old, clear, digit('7'), add, digit('1'), equals)
    expect(current).toMatchObject({ request: { operation: 'add', operands: ['7', '1'] } })

    const late: Action = {
      type: 'settled',
      request: old.request,
      outcome: { kind: 'success', result: '5', exact: true },
    }
    expect(reducer(current, late)).toBe(current)
  })

  it('ignores an answer to an equal request that is not the same object', () => {
    if (calculating.status !== 'Calculating') throw new Error('expected Calculating')
    const copy = { ...calculating.request }
    expect(
      reducer(calculating, { type: 'settled', request: copy, outcome: { kind: 'unreachable' } }),
    ).toBe(calculating)
  })
})

describe('an answer outside Calculating', () => {
  it.each(Object.entries(everyState).filter(([name]) => name !== 'calculating'))(
    'is ignored in %s',
    (_name, state) => {
      if (calculating.status !== 'Calculating') throw new Error('expected Calculating')
      const settled: Action = { type: 'settled', request: calculating.request, outcome: { kind: 'unreachable' } }
      expect(reducer(state, settled)).toBe(state)
    },
  )
})

describe('a negative exponent', () => {
  const power: Action = { type: 'operator', operator: 'power' }
  const subtract: Action = { type: 'operator', operator: 'subtract' }

  it('starts when − follows xʸ, so 2 ^ − 3 sends power(2, -3)', () => {
    expect(run(initialState, digit('2'), power, subtract)).toEqual({
      status: 'EnteringSecond',
      first: typed('2'),
      operator: 'power',
      second: typed('-0'),
    })
    expect(run(initialState, digit('2'), power, subtract, digit('3'), equals)).toMatchObject({
      status: 'Calculating',
      request: { operation: 'power', operands: ['2', '-3'] },
    })
  })

  it('leaves − after any other operator as a correction', () => {
    expect(run(initialState, digit('2'), multiply, subtract)).toEqual({
      status: 'OperatorChosen',
      first: typed('2'),
      operator: 'subtract',
    })
  })
})

describe('entry keys on a typed number', () => {
  it('stay in EnteringFirst', () => {
    expect(run(initialState, ...type('-12.50'))).toEqual({ status: 'EnteringFirst', first: typed('-12.50') })
  })

  it('stay in EnteringSecond', () => {
    expect(run(enteringSecond, ...type('.5-'))).toEqual({ ...enteringSecond, second: typed('-3.5') })
  })

  it('start the second number from 0 after an operator', () => {
    expect(run(operatorChosen, decimalPoint)).toEqual({ ...enteringSecond, second: typed('0.') })
    expect(run(operatorChosen, toggleSign)).toEqual({ ...enteringSecond, second: typed('-0') })
  })

  it('start a new first number from 0 after an error', () => {
    expect(run(error, decimalPoint)).toEqual({ status: 'EnteringFirst', first: typed('0.') })
    expect(run(error, toggleSign)).toEqual({ status: 'EnteringFirst', first: typed('-0') })
  })

  it('leave the state unchanged when a key is rejected', () => {
    const first: State = { status: 'EnteringFirst', first: typed('1.5') }
    expect(reducer(first, decimalPoint)).toBe(first)
    const second: State = { ...enteringSecond, second: typed('1.5') }
    expect(reducer(second, decimalPoint)).toBe(second)
  })

  it('drop a trailing decimal point from the operand and from the number shown while calculating', () => {
    expect(run(initialState, ...type('5.'), add)).toEqual({
      status: 'OperatorChosen',
      first: typed('5'),
      operator: 'add',
    })
    expect(run(operatorChosen, ...type('3.'), equals)).toMatchObject({
      request: { operation: 'add', operands: ['12', '3'] },
      shown: typed('3'),
    })
    expect(run(initialState, ...type('5.'), squareRoot)).toMatchObject({
      request: { operation: 'sqrt', operands: ['5'] },
      shown: typed('5'),
    })
    expect(run(initialState, ...type('5.'), percent)).toMatchObject({ shown: typed('5') })
  })
})

describe('entry keys on a result', () => {
  const rounded: State = { status: 'ShowingResult', result: result(ONE_THIRD, false) }

  it('a digit or the decimal point starts a new typed number', () => {
    expect(run(rounded, digit('0'))).toEqual({ status: 'EnteringFirst', first: typed('0') })
    expect(run(rounded, decimalPoint)).toEqual({ status: 'EnteringFirst', first: typed('0.') })
  })

  it('the sign key negates a shown result and keeps it marked as rounded', () => {
    const negated = run(rounded, toggleSign)
    expect(negated).toEqual({ status: 'ShowingResult', result: result(`-${ONE_THIRD}`, false) })
    expect(run(negated, toggleSign)).toEqual(rounded)
  })

  it('the sign key drops the calculation, which no longer describes the result', () => {
    expect(run(showingResult, toggleSign)).toEqual({ status: 'ShowingResult', result: result('-15') })
  })

  it('a key that changes nothing keeps the calculation', () => {
    expect(reducer(showingResult, equals)).toBe(showingResult)
    expect(reducer(error, add)).toBe(error)
  })

  it('the sign key leaves a zero result as it is', () => {
    const zero: State = { status: 'ShowingResult', result: result('0') }
    expect(reducer(zero, toggleSign)).toBe(zero)
  })

  it('the sign key leaves a result alone when the minus sign would make it too long', () => {
    const longest: State = { status: 'ShowingResult', result: result(`1.${'0'.repeat(254)}`) }
    expect(reducer(longest, toggleSign)).toBe(longest)
  })
})

describe('the % key', () => {
  it('on the second number, sends second% of first and puts the result in its place', () => {
    const state = run(initialState, ...type('50'), add, ...type('10'), percent)
    expect(state).toMatchObject({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['10', '50'] },
    })

    const replaced = run(state, succeed('5'))
    expect(replaced).toEqual({
      status: 'EnteringSecond',
      first: typed('50'),
      operator: 'add',
      second: result('5'),
    })
    expect(run(replaced, equals)).toMatchObject({
      request: { operation: 'add', operands: ['50', '5'] },
    })
  })

  it('then a digit starts a new second number: 50 + 10 % 3 = sends add(50, 3)', () => {
    const state = run(initialState, ...type('50'), add, ...type('10'), percent, succeed('5'), digit('3'), equals)
    expect(state).toMatchObject({ request: { operation: 'add', operands: ['50', '3'] } })
  })

  it('then a digit replaces a rounded result with a typed number', () => {
    const state = run(enteringSecond, percent, succeed(ONE_THIRD, false), digit('7'))
    expect(state).toEqual({ ...enteringSecond, second: typed('7') })
  })

  it('then the sign key negates the result and keeps it marked as rounded', () => {
    const state = run(enteringSecond, percent, succeed(ONE_THIRD, false), toggleSign)
    expect(state).toEqual({ ...enteringSecond, second: result(`-${ONE_THIRD}`, false) })
  })

  it('on the first number, sends value% of 1 and shows the result', () => {
    const shown = run(initialState, ...type('10'), percent, succeed('0.1'))
    expect(shown).toMatchObject({ status: 'ShowingResult', result: result('0.1') })
    expect(run(shown, add)).toEqual({ status: 'OperatorChosen', first: result('0.1'), operator: 'add' })
  })

  it('is ignored when an operator is chosen but no second number is typed', () => {
    expect(reducer(operatorChosen, percent)).toBe(operatorChosen)
  })

  it('is ignored after an error', () => {
    expect(reducer(error, percent)).toBe(error)
  })

  it.each([
    ['the second number', run(enteringSecond, percent)],
    ['the first number', run(enteringFirst, percent)],
  ])('on %s, turns an error into Error', (_name, state) => {
    expect(run(state, answer(divisionByZero))).toMatchObject({ status: 'Error', failure: divisionByZero })
  })
})

describe('other keys', () => {
  it('equals does nothing before a second number is typed', () => {
    for (const state of [enteringFirst, operatorChosen, showingResult, error]) {
      expect(reducer(state, equals)).toBe(state)
    }
  })

  it('a second operator replaces the first', () => {
    expect(run(operatorChosen, multiply)).toEqual({ ...operatorChosen, operator: 'multiply' })
  })

  it('square root is ignored while an operation is pending, and after an error', () => {
    for (const state of [operatorChosen, enteringSecond, error]) {
      expect(reducer(state, squareRoot)).toBe(state)
    }
  })

  it('operators are ignored after an error', () => {
    expect(reducer(error, add)).toBe(error)
  })
})

describe('applyEntryKey on a typed number', () => {
  const edit = (text: string, key: EntryKey) => applyEntryKey(typed(text), key).text
  const d = (digit: Digit): EntryKey => ({ type: 'digit', digit })

  it('replaces a lone zero with the digit', () => {
    expect(edit('0', d('5'))).toBe('5')
    expect(edit('-0', d('5'))).toBe('-5')
    expect(edit('0', d('0'))).toBe('0')
    expect(edit('0.', d('0'))).toBe('0.0')
  })

  it('toggles the sign, including on 0 so a negative number can be typed sign first', () => {
    expect(edit('5', toggleSign)).toBe('-5')
    expect(edit('-5', toggleSign)).toBe('5')
    expect(edit('0', toggleSign)).toBe('-0')
  })

  it('returns the same object when the key changes nothing', () => {
    const shown = typed('1.5')
    expect(applyEntryKey(shown, decimalPoint)).toBe(shown)
  })

  it('rejects a second decimal point', () => {
    expect(edit('1.5', decimalPoint)).toBe('1.5')
  })

  it('rejects a 257th character', () => {
    const longest = `1.${'0'.repeat(254)}` // 256 characters, a valid operand
    expect(edit(longest, d('0'))).toBe(longest)
    expect(edit(longest, toggleSign)).toBe(longest)
  })

  it('rejects a decimal point that no digit could follow', () => {
    // With 255 characters, a point is the 256th and leaves no room for a digit.
    expect(edit('0'.repeat(255), decimalPoint)).toBe('0'.repeat(255))
    expect(edit('0'.repeat(254), decimalPoint)).toBe(`${'0'.repeat(254)}.`)
  })

  it('rejects a 35th significant digit', () => {
    const entry = '1'.repeat(34)
    expect(edit(entry, d('1'))).toBe(entry)
    expect(edit(entry, d('0'))).toBe(`${entry}0`) // a trailing zero is not significant
  })

  it('rejects a number outside the range', () => {
    const largest = '9'.repeat(34) + '0'.repeat(66) // 100 digits, just under 1e100
    expect(edit(largest, d('0'))).toBe(largest)
    const smallest = `0.${'0'.repeat(99)}` // the next digit is the 1e-100 place
    expect(edit(smallest, d('1'))).toBe(`${smallest}1`)
    expect(edit(`${smallest}0`, d('1'))).toBe(`${smallest}0`)
  })
})

describe('a whole calculation', () => {
  it('runs 2 + 3 × 4 left to right, each result becoming the next first number', () => {
    let state = run(initialState, digit('2'), add, digit('3'), multiply)
    expect(state).toMatchObject({ request: { operation: 'add', operands: ['2', '3'] } })
    state = run(state, succeed('5'), digit('4'), equals)
    expect(state).toMatchObject({ request: { operation: 'multiply', operands: ['5', '4'] } })
    expect(run(state, succeed('20'))).toMatchObject({ status: 'ShowingResult', result: result('20') })
  })
})
