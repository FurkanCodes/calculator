import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ValueText } from './ValueText'

// jsdom does no layout, so the tests fake it. Each character is 0.6 em wide,
// as in IBM Plex Mono, and the card is `cardWidth` px wide.
let cardWidth = 248
/** Every connected ResizeObserver callback, Base UI's included. */
const observers = new Set<() => void>()
const resize = () => {
  for (const callback of observers) {
    callback()
  }
}

function Harness({ text, anchor = 'start' }: { text: string; anchor?: 'start' | 'end' }) {
  const ref = useRef<HTMLSpanElement>(null)
  return <ValueText text={text} anchor={anchor} dimmed={false} textRef={ref} />
}

const fontSize = () => screen.getByTestId('value').style.fontSize

beforeEach(() => {
  cardWidth = 248
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return (this.textContent?.length ?? 0) * Number.parseFloat(this.style.fontSize || '40') * 0.6
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => cardWidth)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => 900)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: () => void
      constructor(callback: () => void) {
        this.callback = callback
      }
      observe() {
        observers.add(this.callback)
      }
      unobserve() {}
      disconnect() {
        observers.delete(this.callback)
      }
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ValueText', () => {
  it('shows a short value at 40 px', () => {
    render(<Harness text="42" />)
    expect(fontSize()).toBe('40px')
  })

  it('shrinks a longer value to the largest size that fits', () => {
    // 12 characters: 288 px at 40, 259 at 36, 230 at 32.
    render(<Harness text="123456789012" />)
    expect(fontSize()).toBe('32px')
  })

  it('stops at 26 px and scrolls a value that still does not fit', () => {
    render(<Harness text="0.3333333333333333333333333333333333" />)
    expect(fontSize()).toBe('26px')
  })

  it('shows the leading digits of a result, and the end of a number being typed', () => {
    const { rerender } = render(<Harness text="0.3333333333333333333333333333333333" />)
    const viewport = screen.getByTestId('value').closest('.value-viewport')
    expect(viewport?.scrollLeft).toBe(0)

    rerender(<Harness text="1234567890123456789012345678901234" anchor="end" />)
    expect(viewport?.scrollLeft).toBe(900)
  })

  it('refits when the card width changes, and only then', () => {
    render(<Harness text="123456789012" />)
    expect(fontSize()).toBe('32px')

    cardWidth = 320
    resize()
    expect(fontSize()).toBe('40px')

    screen.getByTestId('value').style.fontSize = '10px'
    resize() // same width: nothing to do
    expect(fontSize()).toBe('10px')
  })

  describe('when the web font arrives', () => {
    let loaded: () => void = () => undefined

    beforeEach(() => {
      const ready = new Promise<void>((resolve) => {
        loaded = resolve
      })
      Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true })
    })

    afterEach(() => {
      Reflect.deleteProperty(document, 'fonts')
    })

    it('fits again, because the font changes the text width', async () => {
      render(<Harness text="123456789012" />)
      expect(fontSize()).toBe('32px')

      cardWidth = 320 // stands in for the narrower web font
      await act(async () => {
        loaded()
        await Promise.resolve()
      })
      expect(fontSize()).toBe('40px')
    })

    it('does nothing once the value has gone', async () => {
      const { unmount } = render(<Harness text="123456789012" />)
      const span = screen.getByTestId('value')
      unmount()

      cardWidth = 320
      await act(async () => {
        loaded()
        await Promise.resolve()
      })
      expect(span.style.fontSize).toBe('32px')
    })
  })

  it('stops observing when it unmounts', () => {
    const { unmount } = render(<Harness text="1" />)
    expect(observers.size).toBeGreaterThan(0)
    unmount()
    expect(observers.size).toBe(0)
  })
})
