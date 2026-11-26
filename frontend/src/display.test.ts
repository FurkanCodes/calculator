import { describe, expect, it } from 'vitest'
import type { Calculation, Result, State, Typed } from './calculator'
import { describe as describeCalculation, displayModel } from './display'

const typed = (text: string): Typed => ({ origin: 'typed', text })
const result = (text: string, exact = true): Result => ({ origin: 'result', text, exact })

const dividing: Calculation = {
  request: { operation: 'divide', operands: ['1', '3'] },
  target: { to: 'ShowingResult' },
}

const plain = { exact: true, dimmed: false, copyable: false }

describe('displayModel', () => {
  it('shows the first number being typed, with no expression, its end in view', () => {
    expect(displayModel({ status: 'EnteringFirst', first: typed('12.') })).toEqual({
      expression: '',
      value: { kind: 'number', text: '12.', ...plain, anchor: 'end' },
    })
  })

  it('shows the first number and its operator once an operator is chosen', () => {
    expect(displayModel({ status: 'OperatorChosen', first: typed('50'), operator: 'add' })).toEqual({
      expression: '50 +',
      value: { kind: 'number', text: '50', ...plain, anchor: 'end' },
    })
  })

  it('keeps a rounded first number marked, with its leading digits in view', () => {
    const state: State = { status: 'OperatorChosen', first: result('0.3333', false), operator: 'multiply' }
    expect(displayModel(state)).toEqual({
      expression: '0.3333 ×',
      value: { kind: 'number', text: '0.3333', ...plain, exact: false, anchor: 'start' },
    })
  })

  it('shows the second number being typed under the first and its operator', () => {
    const state: State = { status: 'EnteringSecond', first: typed('7'), operator: 'subtract', second: typed('-2') }
    expect(displayModel(state)).toEqual({
      expression: '7 −',
      value: { kind: 'number', text: '-2', ...plain, anchor: 'end' },
    })
  })

  it('dims the number the request was sent with, keeping where it was anchored', () => {
    expect(displayModel({ status: 'Calculating', ...dividing, shown: typed('3') })).toEqual({
      expression: '1 ÷ 3 =',
      value: { kind: 'number', text: '3', ...plain, dimmed: true, anchor: 'end' },
    })
    const fromResult = displayModel({ status: 'Calculating', ...dividing, shown: result('3', false) })
    expect(fromResult.value).toMatchObject({ dimmed: true, exact: false, anchor: 'start' })
  })

  it('shows a result under the calculation it answers, and offers to copy it', () => {
    const state: State = {
      status: 'ShowingResult',
      result: result('0.3333333333333333333333333333333333', false),
      calculation: dividing,
    }
    expect(displayModel(state)).toEqual({
      expression: '1 ÷ 3 =',
      value: {
        kind: 'number',
        text: '0.3333333333333333333333333333333333',
        exact: false,
        dimmed: false,
        copyable: true,
        anchor: 'start',
      },
    })
  })

  it('shows no expression for a result without a calculation, such as a negated one', () => {
    expect(displayModel({ status: 'ShowingResult', result: result('-1') }).expression).toBe('')
  })

  it('shows an error in place of the value, under the calculation that failed', () => {
    const state: State = {
      status: 'Error',
      failure: { kind: 'error', code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero.' },
      calculation: { ...dividing, request: { operation: 'divide', operands: ['1', '0'] } },
    }
    expect(displayModel(state)).toEqual({
      expression: '1 ÷ 0 =',
      value: {
        kind: 'failure',
        reason: 'error',
        message: 'Can’t divide by zero.',
        hint: 'Type a number to start again.',
      },
    })
  })
})

describe('describe', () => {
  const on = (operation: Calculation['request']['operation'], ...operands: string[]) => ({ operation, operands })

  it.each<[string, Calculation, string]>([
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
        target: { to: 'EnteringSecond', first: typed('50'), operator: 'subtract' },
      },
      '50 − 10%',
    ],
  ])('writes %s', (_name, calculation, text) => {
    expect(describeCalculation(calculation)).toBe(text)
  })
})
