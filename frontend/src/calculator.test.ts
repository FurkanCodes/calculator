import { describe, expect, it } from 'vitest'
import {
  type Action,
  type Digit,
  editEntry,
  initialState,
  reducer,
  type Settled,
  type State,
} from './calculator'

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state)
}

/** Types a number key by key: digits, '.' and a leading '-' for the sign key. */
function type(text: string): Action[] {
  return [...text].map((c): Action => {
    if (c === '.') return { type: 'decimalPoint' }
    if (c === '-') return { type: 'toggleSign' }
    return { type: 'digit', digit: c as Digit }
  })
}

const digit = (d: Digit): Action => ({ type: 'digit', digit: d })
const add: Action = { type: 'operator', operator: 'add' }
const multiply: Action = { type: 'operator', operator: 'multiply' }
const equals: Action = { type: 'equals' }
const squareRoot: Action = { type: 'squareRoot' }
const percent: Action = { type: 'percent' }
const clear: Action = { type: 'clear' }
const success = (result: string, exact = true): Action => ({
  type: 'settled',
  outcome: { kind: 'success', result, exact },
})
const divisionByZero: Settled = {
  kind: 'error',
  code: 'DIVISION_BY_ZERO',
  message: 'Cannot divide by zero.',
}

// One state of each kind, for the rules that hold in every state.
const enteringFirst: State = { status: 'EnteringFirst', entry: '12' }
const operatorChosen: State = { status: 'OperatorChosen', first: '12', operator: 'add', exact: true }
const enteringSecond: State = {
  status: 'EnteringSecond',
  first: '12',
  operator: 'add',
  entry: '3',
  exact: true,
}
const calculating: State = {
  status: 'Calculating',
  request: { operation: 'add', operands: ['12', '3'] },
  target: { to: 'ShowingResult' },
}
const showingResult: State = { status: 'ShowingResult', result: '15', exact: true }
const error: State = { status: 'Error', failure: { kind: 'unreachable' } }

const everyState = { enteringFirst, operatorChosen, enteringSecond, calculating, showingResult, error }

describe('the state diagram', () => {
  it('starts in EnteringFirst with 0', () => {
    expect(initialState).toEqual({ status: 'EnteringFirst', entry: '0' })
  })

  it('EnteringFirst --operator--> OperatorChosen', () => {
    expect(run(enteringFirst, add)).toEqual(operatorChosen)
  })

  it('EnteringFirst --square root--> Calculating', () => {
    expect(run(enteringFirst, squareRoot)).toEqual({
      status: 'Calculating',
      request: { operation: 'sqrt', operands: ['12'] },
      target: { to: 'ShowingResult' },
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
      status: 'Calculating',
      request: { operation: 'add', operands: ['12', '3'] },
      target: { to: 'OperatorChosen', operator: 'multiply' },
    })
  })

  it('Calculating --success--> ShowingResult, keeping the exact flag', () => {
    expect(run(calculating, success('15'))).toEqual(showingResult)
    expect(run(calculating, success('0.3333333333333333333333333333333333', false))).toEqual({
      status: 'ShowingResult',
      result: '0.3333333333333333333333333333333333',
      exact: false,
    })
  })

  it('Calculating --error--> Error', () => {
    expect(run(calculating, { type: 'settled', outcome: divisionByZero })).toEqual({
      status: 'Error',
      failure: divisionByZero,
    })
  })

  it('Calculating --no connection--> Error', () => {
    expect(run(calculating, { type: 'settled', outcome: { kind: 'unreachable' } })).toEqual(error)
  })

  it('ShowingResult --operator--> OperatorChosen, with the result as the first number', () => {
    expect(run(showingResult, multiply)).toEqual({
      status: 'OperatorChosen',
      first: '15',
      operator: 'multiply',
      exact: true,
    })
    expect(run({ ...showingResult, exact: false }, multiply)).toMatchObject({ exact: false })
  })

  it('ShowingResult --digit--> EnteringFirst, starting a new number', () => {
    expect(run(showingResult, digit('7'))).toEqual({ status: 'EnteringFirst', entry: '7' })
  })

  it('Error --digit--> EnteringFirst, starting a new number', () => {
    expect(run(error, digit('7'))).toEqual({ status: 'EnteringFirst', entry: '7' })
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
    ['the decimal point', { type: 'decimalPoint' }],
    ['the sign key', { type: 'toggleSign' }],
    ['an operator', add],
    ['equals', equals],
    ['square root', squareRoot],
    ['percent', percent],
  ])('ignores %s', (_name, action) => {
    expect(reducer(calculating, action)).toBe(calculating)
  })

  it('makes a result started by an operator the first number, with that operator chosen', () => {
    const started = run(enteringSecond, multiply)
    expect(run(started, success('15', false))).toEqual({
      status: 'OperatorChosen',
      first: '15',
      operator: 'multiply',
      exact: false,
    })
  })

  it('turns an error from an operator-started request into Error', () => {
    const started = run(enteringSecond, multiply)
    expect(run(started, { type: 'settled', outcome: divisionByZero })).toEqual({
      status: 'Error',
      failure: divisionByZero,
    })
  })
})

describe('a settled request outside Calculating', () => {
  it.each(Object.entries(everyState).filter(([name]) => name !== 'calculating'))(
    'is ignored in %s',
    (_name, state) => {
      expect(reducer(state, success('1'))).toBe(state)
    },
  )
})

describe('entry keys', () => {
  it('stay in EnteringFirst', () => {
    expect(run(initialState, ...type('-12.50'))).toEqual({ status: 'EnteringFirst', entry: '-12.50' })
  })

  it('stay in EnteringSecond, and mark a typed number exact', () => {
    const rounded: State = { ...enteringSecond, entry: '0.5', exact: false }
    expect(run(rounded, digit('1'))).toEqual({ ...rounded, entry: '0.51', exact: true })
    expect(run(rounded, { type: 'decimalPoint' })).toBe(rounded) // 0.5. is not a number
  })

  it('keep a rounded second number rounded when only its sign changes', () => {
    const rounded: State = { ...enteringSecond, entry: '0.5', exact: false }
    expect(run(rounded, { type: 'toggleSign' })).toEqual({ ...rounded, entry: '-0.5' })
  })

  it('start the second number from 0 after an operator', () => {
    expect(run(operatorChosen, { type: 'decimalPoint' })).toMatchObject({
      status: 'EnteringSecond',
      entry: '0.',
    })
    expect(run(operatorChosen, { type: 'toggleSign' })).toMatchObject({
      status: 'EnteringSecond',
      entry: '-0',
    })
  })

  it.each([showingResult, error])('start a new first number from 0 in $status', (state) => {
    expect(run(state, { type: 'decimalPoint' })).toEqual({ status: 'EnteringFirst', entry: '0.' })
    expect(run(state, { type: 'toggleSign' })).toEqual({ status: 'EnteringFirst', entry: '-0' })
  })

  it('leave the state unchanged when a key is rejected', () => {
    const state: State = { status: 'EnteringFirst', entry: '1.5' }
    expect(reducer(state, { type: 'decimalPoint' })).toBe(state)
    const second: State = { ...enteringSecond, entry: '1.5' }
    expect(reducer(second, { type: 'decimalPoint' })).toBe(second)
  })

  it('drop a trailing decimal point from the operand', () => {
    expect(run(initialState, ...type('5.'), add)).toMatchObject({ first: '5' })
    expect(run(operatorChosen, ...type('3.'), equals)).toMatchObject({
      request: { operation: 'add', operands: ['12', '3'] },
    })
  })
})

describe('editEntry', () => {
  it('replaces a lone zero with the digit', () => {
    expect(editEntry('0', { type: 'digit', digit: '5' })).toBe('5')
    expect(editEntry('-0', { type: 'digit', digit: '5' })).toBe('-5')
    expect(editEntry('0', { type: 'digit', digit: '0' })).toBe('0')
    expect(editEntry('0.', { type: 'digit', digit: '0' })).toBe('0.0')
  })

  it('toggles the sign', () => {
    expect(editEntry('5', { type: 'toggleSign' })).toBe('-5')
    expect(editEntry('-5', { type: 'toggleSign' })).toBe('5')
    expect(editEntry('0', { type: 'toggleSign' })).toBe('-0')
  })

  it('rejects a second decimal point', () => {
    expect(editEntry('1.5', { type: 'decimalPoint' })).toBe('1.5')
  })

  it('rejects a 257th character', () => {
    const longest = `1.${'0'.repeat(254)}` // 256 characters, a valid operand
    expect(editEntry(longest, { type: 'digit', digit: '0' })).toBe(longest)
    expect(editEntry(longest, { type: 'toggleSign' })).toBe(longest)
  })

  it('rejects a decimal point that no digit could follow', () => {
    // With 255 characters, a point is the 256th and leaves no room for a digit.
    expect(editEntry('0'.repeat(255), { type: 'decimalPoint' })).toBe('0'.repeat(255))
    expect(editEntry('0'.repeat(254), { type: 'decimalPoint' })).toBe(`${'0'.repeat(254)}.`)
  })

  it('rejects a 35th significant digit', () => {
    const entry = '1'.repeat(34)
    expect(editEntry(entry, { type: 'digit', digit: '1' })).toBe(entry)
    expect(editEntry(entry, { type: 'digit', digit: '0' })).toBe(`${entry}0`) // trailing zero
  })

  it('rejects a number outside the range', () => {
    const largest = '9'.repeat(34) + '0'.repeat(66) // 100 digits, just under 1e100
    expect(editEntry(largest, { type: 'digit', digit: '0' })).toBe(largest)
    const smallest = `0.${'0'.repeat(99)}` // the next digit is the 1e-100 place
    expect(editEntry(smallest, { type: 'digit', digit: '1' })).toBe(`${smallest}1`)
    expect(editEntry(`${smallest}0`, { type: 'digit', digit: '1' })).toBe(`${smallest}0`)
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

  it('square root takes the shown result', () => {
    expect(run(showingResult, squareRoot)).toEqual({
      status: 'Calculating',
      request: { operation: 'sqrt', operands: ['15'] },
      target: { to: 'ShowingResult' },
    })
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

describe('the % key', () => {
  it('on the second number, sends second% of first and puts the result in its place', () => {
    const state = run(initialState, ...type('50'), add, ...type('10'), percent)
    expect(state).toEqual({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['10', '50'] },
      target: { to: 'EnteringSecond', first: '50', operator: 'add' },
    })

    const replaced = run(state, success('5'))
    expect(replaced).toEqual({
      status: 'EnteringSecond',
      first: '50',
      operator: 'add',
      entry: '5',
      exact: true,
    })
    expect(run(replaced, equals)).toMatchObject({
      request: { operation: 'add', operands: ['50', '5'] },
    })
  })

  it('on the second number, keeps a rounded result marked as rounded', () => {
    const state = run(enteringSecond, percent, success('0.3333333333333333333333333333333333', false))
    expect(state).toMatchObject({ status: 'EnteringSecond', exact: false })
  })

  it('on the first number, sends value% of 1 and shows the result', () => {
    const state = run(initialState, ...type('10'), percent)
    expect(state).toEqual({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['10', '1'] },
      target: { to: 'ShowingResult' },
    })
    const shown = run(state, success('0.1'))
    expect(shown).toEqual({ status: 'ShowingResult', result: '0.1', exact: true })
    expect(run(shown, add)).toMatchObject({ status: 'OperatorChosen', first: '0.1' })
  })

  it('on a shown result, sends result% of 1', () => {
    expect(run(showingResult, percent)).toEqual({
      status: 'Calculating',
      request: { operation: 'percentage', operands: ['15', '1'] },
      target: { to: 'ShowingResult' },
    })
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
    expect(run(state, { type: 'settled', outcome: divisionByZero })).toEqual({
      status: 'Error',
      failure: divisionByZero,
    })
  })
})

describe('a whole calculation', () => {
  it('runs 2 + 3 × 4 left to right, each result becoming the next first number', () => {
    let state = run(initialState, digit('2'), add, digit('3'), multiply)
    expect(state).toMatchObject({ request: { operation: 'add', operands: ['2', '3'] } })
    state = run(state, success('5'), digit('4'), equals)
    expect(state).toMatchObject({ request: { operation: 'multiply', operands: ['5', '4'] } })
    expect(run(state, success('20'))).toEqual({ status: 'ShowingResult', result: '20', exact: true })
  })
})
