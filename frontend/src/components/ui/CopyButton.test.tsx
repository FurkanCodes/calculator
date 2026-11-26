import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIRM_MS, CopyButton } from './CopyButton'

function Harness({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <>
      <span ref={ref}>{text}</span>
      <CopyButton text={text} fallbackRef={ref} />
    </>
  )
}

function setClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  window.getSelection()?.removeAllRanges()
  vi.useRealTimers()
})

/** Clicks Copy and lets the clipboard promise settle. */
async function clickCopy() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await Promise.resolve()
  })
}

describe('CopyButton', () => {
  it('copies the full value and confirms, then reads Copy again', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(() => Promise.resolve())
    setClipboard({ writeText })
    render(<Harness text="0.3333333333333333333333333333333333" />)

    await clickCopy()

    expect(writeText).toHaveBeenCalledWith('0.3333333333333333333333333333333333')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Copied to the clipboard.')

    act(() => {
      vi.advanceTimersByTime(CONFIRM_MS)
    })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('selects the value when there is no clipboard', async () => {
    setClipboard(undefined)
    render(<Harness text="42" />)

    await clickCopy()

    expect(screen.getByRole('button', { name: 'Selected' })).toBeDefined()
    expect(window.getSelection()?.toString()).toBe('42')
  })

  it('selects the value when the clipboard refuses', async () => {
    setClipboard({ writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) })
    render(<Harness text="42" />)

    await clickCopy()

    expect(screen.getByRole('button', { name: 'Selected' })).toBeDefined()
    expect(window.getSelection()?.toString()).toBe('42')
  })

  it('still confirms the fallback when there is nothing to select', async () => {
    setClipboard(undefined)
    render(<CopyButton text="42" fallbackRef={{ current: null }} />)

    await clickCopy()

    expect(screen.getByRole('button', { name: 'Selected' })).toBeDefined()
  })

  it('stops its timer when it unmounts', async () => {
    vi.useFakeTimers()
    setClipboard({ writeText: () => Promise.resolve() })
    const { unmount } = render(<Harness text="1" />)
    await clickCopy()

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
