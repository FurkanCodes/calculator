import { ScrollArea } from '@base-ui/react/scroll-area'
import { type RefObject, useLayoutEffect, useRef } from 'react'

/** In px, largest first. */
const SIZES = [40, 36, 32, 28, 26] as const

interface ValueTextProps {
  text: string
  anchor: 'start' | 'end'
  dimmed: boolean
  /** The Copy button selects this when the clipboard fails. */
  textRef: RefObject<HTMLSpanElement | null>
}

/**
 * The size is measured instead of estimated from the character count. That
 * keeps arithmetic out of the frontend (rule 1) and works for whichever font
 * has loaded. ScrollArea makes the viewport focusable only when it scrolls.
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
      // When nothing fits, the smallest size stays set and the text scrolls.
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
    // Refit on width changes only. Fitting changes the height, so reacting to
    // every resize would loop.
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
            className={`inline-block py-1.5 font-mono text-[40px] leading-none whitespace-nowrap tabular-nums ${dimmed ? 'value-dimmed' : 'text-ink'}`}
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
