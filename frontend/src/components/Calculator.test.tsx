import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ERROR_CODES } from '../api/client'
import { ERROR_MESSAGES } from '../calculator/messages'
import { Calculator } from './Calculator'

/** A fetch that answers every request with the same JSON body. */
function answer(status: number, body: unknown) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** A fetch the test answers by hand. */
function deferredFetch() {
  const calls: { init: RequestInit; answer: (status: number, body: unknown) => void }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          calls.push({
            init,
            answer: (status, body) => {
              resolve(new Response(JSON.stringify(body), { status }))
            },
          })
        }),
    ),
  )
  return calls
}

/** Clicks keypad keys by their accessible names. */
function click(...names: string[]) {
  for (const name of names) {
    fireEvent.click(screen.getByRole('button', { name }))
  }
}

function type(...keys: string[]) {
  for (const key of keys) {
    fireEvent.keyDown(document.body, { key })
  }
}

const display = () => screen.getByRole('region', { name: 'Display' })
const value = () => screen.getByTestId('value').textContent
const expression = () => screen.getByTestId('expression').textContent
/** The live region that holds the value or the error. */
const output = () => display().querySelector('[role="status"][aria-live="polite"]')
const sentBody = (fetchMock: ReturnType<typeof answer>, call = 0) => fetchMock.mock.calls[call]?.[1].body

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the keypad', () => {
  it('has every key as a real button, with names for the symbol keys', () => {
    render(<Calculator />)
    const names = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)
    expect(names).toEqual([
      'Clear',
      'Square root',
      'Power',
      'Percent',
      '7',
      '8',
      '9',
      'Divide',
      '4',
      '5',
      '6',
      'Multiply',
      '1',
      '2',
      '3',
      'Subtract',
      'Change sign',
      '0',
      'Decimal point',
      'Add',
      'Equals',
    ])
  })

  it('keeps focus where it was when a key is pressed with a pointer, so Enter still means equals', async () => {
    const fetchMock = answer(200, { result: '9', exact: true })
    const user = userEvent.setup()
    render(<Calculator />)

    await user.click(screen.getByRole('button', { name: '7' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    expect(document.activeElement).toBe(document.body)

    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(value()).toBe('9')
    })
    expect(sentBody(fetchMock)).toBe('{"operation":"add","operands":["7","2"]}')
  })

  it('presses a key reached with Tab when Enter is pressed on it', async () => {
    const user = userEvent.setup()
    render(<Calculator />)

    await user.tab() // the About link in the header
    await user.tab() // Clear
    await user.tab() // Square root
    await user.tab() // Power
    await user.tab() // Percent
    await user.tab() // 7
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '7' }))
    await user.keyboard('{Enter}')
    expect(value()).toBe('7')
  })

  it('types a number and shows it, starting from 0', () => {
    render(<Calculator />)
    expect(value()).toBe('0')
    click('1', '2', 'Decimal point', '5', 'Change sign')
    expect(value()).toBe('-12.5')
    expect(expression()).toBe('')
  })

  it('sends the calculation to the backend and shows the result under its expression', async () => {
    const fetchMock = answer(200, { result: '60', exact: true })
    render(<Calculator />)

    click('5', '0', 'Add')
    expect(expression()).toBe('50 +')
    click('1', '0', 'Equals')

    await waitFor(() => {
      expect(value()).toBe('60')
    })
    expect(expression()).toBe('50 + 10 =')
    expect(sentBody(fetchMock)).toBe('{"operation":"add","operands":["50","10"]}')
  })

  it('puts the result of % on the second number in its place', async () => {
    const fetchMock = answer(200, { result: '5', exact: true })
    render(<Calculator />)

    click('5', '0', 'Add', '1', '0', 'Percent')
    expect(expression()).toBe('50 + 10%')
    await waitFor(() => {
      expect(value()).toBe('5')
    })
    expect(expression()).toBe('50 +')
    expect(sentBody(fetchMock)).toBe('{"operation":"percentage","operands":["10","50"]}')
  })

  it('chains an operator: the result becomes the first number', async () => {
    const fetchMock = answer(200, { result: '5', exact: true })
    render(<Calculator />)

    click('2', 'Add', '3', 'Power')
    expect(expression()).toBe('2 + 3')
    await waitFor(() => {
      expect(expression()).toBe('5 ^')
    })
    expect(value()).toBe('5')
    expect(sentBody(fetchMock)).toBe('{"operation":"add","operands":["2","3"]}')
  })

  it('sends the square root of the shown number', async () => {
    const fetchMock = answer(200, { result: '3', exact: true })
    render(<Calculator />)

    click('9', 'Square root')
    await waitFor(() => {
      expect(value()).toBe('3')
    })
    expect(expression()).toBe('√9 =')
    expect(sentBody(fetchMock)).toBe('{"operation":"sqrt","operands":["9"]}')
  })

  it('drops the expression once the sign key changes a result', async () => {
    answer(200, { result: '0.5', exact: true })
    render(<Calculator />)
    click('1', 'Divide', '2', 'Equals')
    await waitFor(() => {
      expect(expression()).toBe('1 ÷ 2 =')
    })

    click('Change sign')
    expect(value()).toBe('-0.5')
    expect(expression()).toBe('')
  })
})

describe('the keyboard', () => {
  it('drives the same calculator as the keypad', async () => {
    const fetchMock = answer(200, { result: '15', exact: true })
    render(<Calculator />)

    type('1', '2', '.', '5', '+', '2', '.', '5')
    expect(expression()).toBe('12.5 +')
    expect(value()).toBe('2.5')
    type('Enter')

    await waitFor(() => {
      expect(value()).toBe('15')
    })
    expect(sentBody(fetchMock)).toBe('{"operation":"add","operands":["12.5","2.5"]}')

    type('Escape')
    expect(value()).toBe('0')
    expect(expression()).toBe('')
  })

  it.each([
    ['-', 'subtract'],
    ['*', 'multiply'],
    ['/', 'divide'],
    ['^', 'power'],
  ])('maps %s to %s, and = to equals', async (key, operation) => {
    const fetchMock = answer(200, { result: '1', exact: true })
    render(<Calculator />)
    type('8', key, '2', '=')
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    expect(sentBody(fetchMock)).toBe(`{"operation":"${operation}","operands":["8","2"]}`)
  })

  it('clears with Delete, and has no Backspace', () => {
    render(<Calculator />)
    type('4', '2', 'Backspace')
    expect(value()).toBe('42')
    type('Delete')
    expect(value()).toBe('0')
  })

  it('leaves keys typed into another input alone', () => {
    render(
      <>
        <Calculator />
        <input aria-label="Note" />
      </>,
    )
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note' }), { key: '7' })
    expect(value()).toBe('0')
  })

  it('stops listening when the calculator unmounts', () => {
    const fetchMock = answer(200, { result: '3', exact: true })
    const { unmount } = render(<Calculator />)
    type('1', '+', '2')
    unmount()

    type('Enter')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the display', () => {
  it('marks a rounded result and offers to copy it', async () => {
    answer(200, { result: '0.3333333333333333333333333333333333', exact: false })
    render(<Calculator />)
    click('1', 'Divide', '3', 'Equals')

    await waitFor(() => {
      expect(value()).toBe('0.3333333333333333333333333333333333')
    })
    expect(expression()).toBe('1 ÷ 3 =')
    expect(screen.getByText('≈ Rounded to 34 digits')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDefined()
    // The live region says so too, for screen readers.
    expect(output()?.textContent).toBe('0.3333333333333333333333333333333333, rounded to 34 significant digits')
  })

  it('shows no rounded marker on an exact result', async () => {
    answer(200, { result: '0.3', exact: true })
    render(<Calculator />)
    click('0', 'Decimal point', '1', 'Add', '0', 'Decimal point', '2', 'Equals')

    await waitFor(() => {
      expect(value()).toBe('0.3')
    })
    expect(screen.queryByText('≈ Rounded to 34 digits')).toBeNull()
    expect(output()?.textContent).toBe('0.3')
  })

  it('keeps the rounded marker on a rounded first number after an operator', async () => {
    answer(200, { result: '0.3333333333333333333333333333333333', exact: false })
    render(<Calculator />)
    click('1', 'Divide', '3', 'Equals')
    await waitFor(() => {
      expect(screen.getByText('≈ Rounded to 34 digits')).toBeDefined()
    })

    click('Multiply')
    expect(screen.getByText('≈ Rounded to 34 digits')).toBeDefined()
    // Copy is for a finished result only.
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
    click('3')
    expect(screen.queryByText('≈ Rounded to 34 digits')).toBeNull()
  })

  it('announces the value politely', () => {
    render(<Calculator />)
    expect(output()?.textContent).toBe('0')
  })

  it('keeps the expression to one line, with the full text in its title', async () => {
    const long = `1${'0'.repeat(30)}`
    answer(200, { result: '1', exact: true })
    render(<Calculator />)
    type(...long, '*', '1', '0', '=')
    await waitFor(() => {
      expect(value()).toBe('1')
    })

    const line = screen.getByTestId('expression')
    expect(line.textContent).toBe(`${long} × 10 =`)
    expect(line.title).toBe(`${long} × 10 =`)
    // Runs right to left, so the ellipsis cuts the start and the = stays in view.
    expect(line.getAttribute('dir')).toBe('rtl')
    expect(line.className).toContain('truncate')
  })
})

describe('calculating', () => {
  it('dims the previous value and marks the card busy until the answer', async () => {
    const calls = deferredFetch()
    render(<Calculator />)
    click('7', 'Multiply', '6', 'Equals')

    expect(display().getAttribute('aria-busy')).toBe('true')
    expect(value()).toBe('6')
    expect(screen.getByText('Calculating…')).toBeDefined()
    expect(expression()).toBe('7 × 6 =')

    calls[0]?.answer(200, { result: '42', exact: true })
    await waitFor(() => {
      expect(value()).toBe('42')
    })
    expect(display().getAttribute('aria-busy')).toBe('false')
    expect(screen.queryByText('Calculating…')).toBeNull()
  })

  it('keeps keys typed before the answer, so typing fast gives the same result', async () => {
    const calls = deferredFetch()
    render(<Calculator />)
    type('2', '+', '3', '*') // sends 2 + 3
    type('4', '=') // typed before its answer
    expect(calls).toHaveLength(1)

    calls[0]?.answer(200, { result: '5', exact: true })
    await waitFor(() => {
      expect(calls).toHaveLength(2)
    })
    expect(calls[1]?.init.body).toBe('{"operation":"multiply","operands":["5","4"]}')
    expect(expression()).toBe('5 × 4 =')

    calls[1]?.answer(200, { result: '20', exact: true })
    await waitFor(() => {
      expect(value()).toBe('20')
    })
  })

  it('Clear cancels the request and starts again', async () => {
    const calls = deferredFetch()
    render(<Calculator />)
    click('7', 'Multiply', '6', 'Equals')
    click('Clear')

    expect(calls[0]?.init.signal?.aborted).toBe(true)
    expect(display().getAttribute('aria-busy')).toBe('false')
    expect(value()).toBe('0')
    expect(expression()).toBe('')

    calls[0]?.answer(200, { result: '42', exact: true })
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    expect(value()).toBe('0')
  })
})

describe('errors', () => {
  it.each(ERROR_CODES.filter((code) => code !== 'SERVICE_UNAVAILABLE'))(
    'shows its own text for %s, and how to go on',
    async (code) => {
      answer(422, { error: { code, message: 'The backend message.' } })
      render(<Calculator />)
      click('1', 'Divide', '0', 'Equals')

      await waitFor(() => {
        expect(output()?.textContent).toBe(ERROR_MESSAGES[code])
      })
      expect(screen.getByText('Type a number to start again.')).toBeDefined()
      expect(screen.queryByText(code)).toBeNull()
      expect(expression()).toBe('1 ÷ 0 =')
    },
  )

  it('shows the backend message for a code it does not know', async () => {
    answer(422, { error: { code: 'TOO_SPOOKY', message: 'That number is too spooky.' } })
    render(<Calculator />)
    click('1', 'Add', '3', 'Equals')

    await waitFor(() => {
      expect(output()?.textContent).toBe('That number is too spooky.')
    })
  })

  it('starts a new number on a digit after an error', async () => {
    answer(422, { error: { code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero.' } })
    render(<Calculator />)
    click('1', 'Divide', '0', 'Equals')
    await waitFor(() => {
      expect(output()?.textContent).toBe('Can’t divide by zero.')
    })

    click('Add') // ignored after an error
    click('8')
    expect(value()).toBe('8')
    expect(expression()).toBe('')
  })

  it('says something went wrong for an answer that breaks the API contract', async () => {
    answer(200, { result: 'NaN', exact: true })
    render(<Calculator />)
    click('2', 'Add', '2', 'Equals')

    await waitFor(() => {
      expect(output()?.textContent).toBe('Something went wrong.')
    })
    expect(screen.getByText('Try again, or press C to start over.')).toBeDefined()
  })

  it('shows the unreachable state when there is no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    render(<Calculator />)
    click('2', 'Add', '2', 'Equals')

    await waitFor(() => {
      expect(output()?.textContent).toBe('Can’t reach the calculator.')
    })
    expect(screen.getByText('Check your connection, then try again.')).toBeDefined()
    expect(screen.queryByText('Type a number to start again.')).toBeNull()
  })

  it('shows the unreachable state for nginx’s SERVICE_UNAVAILABLE', async () => {
    answer(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'The calculator is unavailable.' } })
    render(<Calculator />)
    click('2', 'Add', '2', 'Equals')

    await waitFor(() => {
      expect(output()?.textContent).toBe('Can’t reach the calculator.')
    })
  })
})
