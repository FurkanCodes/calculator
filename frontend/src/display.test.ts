import { describe, expect, it } from 'vitest'
import type { Result, State, Typed } from './calculator'
import { type Calculating, describe as describeCalculation, displayModel } from './display'

const typed = (text: string): Typed => ({ origin: 'typed', text })
const result = (text: string, exact = true): Result => ({ origin: 'result', text, exact })

const dividing: Calculating = {
  status: 'Calculating',
  request: { operation: 'divide', operands: ['1', '3'] },
  target: { to: 'ShowingResult' },
  shown: typed('3'),
}

describe('displayModel', () => {
  it('shows the first number being typed, with no expression', () => {
    expect(displayModel({ status: 'EnteringFirst', first: typed('12.') }, null)).toEqual({
      expression: '',
      value: { kind: 'number', text: '12.', exact: true, copyable: false, anchor: 'end' },
    })
  })

  it('shows the first number and its operator once an operator is chosen', () => {
    const state: State = { status: 'OperatorChosen', first: typed('50.'), operator: 'add' }
    expect(displayModel(state, null)).toEqual({
      expression: '50 +',
      value: { kind: 'number', text: '50.', exact: true, copyable: false, anchor: 'end' },
    })
  })

  it('keeps a rounded first number marked, with its leading digits in view', () => {
    const state: State = { status: 'OperatorChosen', first: result('0.3333', false), operator: 'multiply' }
    expect(displayModel(state, null)).toEqual({
      expression: '0.3333 ×',
      value: { kind: 'number', text: '0.3333', exact: false, copyable: false, anchor: 'start' },
    })
  })

  it('shows the second number being typed under the first and its operator', () => {
    const state: State = { status: 'EnteringSecond', first: typed('7'), operator: 'subtract', second: typed('-2') }
    expect(displayModel(state, null)).toEqual({
      expression: '7 −',
      value: { kind: 'number', text: '-2', exact: true, copyable: false, anchor: 'end' },
    })
  })

  it('shows the calculation and the number shown when it was sent, while calculating', () => {
    expect(displayModel(dividing, null)).toEqual({
      expression: '1 ÷ 3 =',
      value: { kind: 'calculating', text: '3' },
    })
  })

  it('shows a result under the calculation it answers, and offers to copy it', () => {
    const state: State = { status: 'ShowingResult', result: result('0.3333333333333333333333333333333333', false) }
    expect(displayModel(state, dividing)).toEqual({
      expression: '1 ÷ 3 =',
      value: {
        kind: 'number',
        text: '0.3333333333333333333333333333333333',
        exact: false,
        copyable: true,
        anchor: 'start',
      },
    })
  })

  it('shows an error in place of the value, under the calculation that failed', () => {
    const state: State = {
      status: 'Error',
      failure: { kind: 'error', code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero.' },
    }
    const failed: Calculating = { ...dividing, request: { operation: 'divide', operands: ['1', '0'] } }
    expect(displayModel(state, failed)).toEqual({
      expression: '1 ÷ 0 =',
      value: {
        kind: 'failure',
        reason: 'error',
        message: 'Can’t divide by zero.',
        hint: 'Type a number to start again.',
      },
    })
  })

  it('shows no expression for a result or error that answers no known calculation', () => {
    expect(displayModel({ status: 'ShowingResult', result: result('-1') }, null).expression).toBe('')
    expect(displayModel({ status: 'Error', failure: { kind: 'unreachable' } }, null).expression).toBe('')
  })
})

describe('describe', () => {
  const on = (operation: Calculating['request']['operation'], ...operands: string[]) => ({ operation, operands })

  it.each<[string, Pick<Calculating, 'request' | 'target'>, string]>([
    ['a sum, ending in =', { request: on('add', '50', '10'), target: { to: 'ShowingResult' } }, '50 + 10 ='],
    [
      'an operator-started product, without =',
      { request: on('multiply', '2', '3'), target: { to: 'OperatorChosen', operator: 'divide' } },
      '2 × 3',
    ],
    ['a power', { request: on('power', '2', '10'), target: { to: 'ShowingResult' } }, '2 ^ 10 ='],
    ['a square root', { request: on('sqrt', '9'), target: { to: 'ShowingResult' } }, '√9 ='],
    ['% of the first number', { request: on('percentage', '10', '1'), target: { to: 'ShowingResult' } }, '10% ='],
    [
      '% of the second number, in the order it was typed',
      {
        request: on('percentage', '10', '50'),
        target: { to: 'EnteringSecond', first: typed('50.'), operator: 'subtract' },
      },
      '50 − 10%',
    ],
  ])('writes %s', (_name, calculation, text) => {
    expect(describeCalculation(calculation)).toBe(text)
  })
})
