import { ScrollArea } from '@base-ui/react/scroll-area'
import { type RefObject, useLayoutEffect, useRef } from 'react'
import { fittingSize } from '../fit'

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
 * for the smallest size, it scrolls horizontally. Base UI's ScrollArea makes
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
    const fit = () => {
      const size = fittingSize((px) => {
        span.style.fontSize = `${px}px`
        return span.offsetWidth <= root.clientWidth
      })
      span.style.fontSize = `${size}px`
      viewport.scrollLeft = anchor === 'end' ? viewport.scrollWidth : 0
    }
    fit()

    if (typeof ResizeObserver === 'undefined') {
      return
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
