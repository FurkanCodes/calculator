import { ScrollArea } from '@base-ui/react/scroll-area'
import { type RefObject, useLayoutEffect, useRef } from 'react'

/** The value's font sizes in px, largest first. The last is the smallest. */
const SIZES = [40, 36, 32, 28, 26] as const

interface ValueTextProps {
  text: string
  /** The end kept in view when the text doesn't fit: see ValueModel. */
  anchor: 'start' | 'end'
  dimmed: boolean
  /** The element holding the text. The Copy button selects it when the clipboard fails. */
  textRef: RefObject<HTMLSpanElement | null>
}

/**
 * The value, right-aligned at the largest size that fits the card. Too long
 * for the smallest size, it scrolls horizontally. The size is measured, not
 * estimated from the number of characters, which keeps arithmetic out of the
 * frontend (rule 1) and holds for whichever font has loaded. Base UI's ScrollArea makes
 * the viewport focusable only when it scrolls, and marks which edges hide
 * digits, so the fade shows only where digits are hidden.
 */
export function ValueText({ text, anchor, dimmed, textRef }: ValueTextProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const viewport = viewportRef.current
    const span = textRef.current
    if (root === null || viewport === null || span === null) {
      return
    }
    let active = true
    const fit = () => {
      if (!active) {
        return
      }
      // Try each size, largest first, and keep the first that fits. When none
      // fits, the last one tried, the smallest, stays, and the text scrolls.
      SIZES.some((px) => {
        span.style.fontSize = `${px}px`
        return span.offsetWidth <= root.clientWidth
      })
      viewport.scrollLeft = anchor === 'end' ? viewport.scrollWidth : 0
    }
    fit()
    // IBM Plex Mono may arrive after the first fit, with different widths.
    void document.fonts?.ready.then(fit)

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        active = false
      }
    }
    // Refit when the card's width changes. Fitting changes the height, so
    // reacting to every resize would loop.
    let width = root.clientWidth
    const observer = new ResizeObserver(() => {
      if (root.clientWidth !== width) {
        width = root.clientWidth
        fit()
      }
    })
    observer.observe(root)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [text, anchor, textRef])

  return (
    <ScrollArea.Root ref={rootRef} className="relative w-full">
      <ScrollArea.Viewport ref={viewportRef} className="value-viewport focus-ring rounded-sm">
        <ScrollArea.Content className="text-right">
          <span
            ref={textRef}
            className={`inline-block py-1.5 font-mono text-[40px] leading-tight whitespace-nowrap tabular-nums ${dimmed ? 'value-dimmed' : 'text-ink'}`}
            data-testid="value"
          >
            {text}
          </span>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="horizontal"
        className="flex h-1 rounded-full opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100"
      >
        <ScrollArea.Thumb className="rounded-full bg-function-key-border" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
}
