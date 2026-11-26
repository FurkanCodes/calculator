import { type RefObject, useEffect, useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'

type CopyStatus = 'idle' | 'copied' | 'selected'

/** How long "Copied" or "Selected" stays before the label goes back to "Copy". */
export const CONFIRM_MS = 2000

const ANNOUNCEMENTS: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Copied to the clipboard.',
  selected: 'The value is selected. Copy it with your keyboard.',
}

interface CopyButtonProps {
  text: string
  /** The element to select when the clipboard is unavailable. */
  fallbackRef: RefObject<HTMLElement | null>
}

/**
 * Without clipboard access (an insecure origin or a denied permission) it
 * selects the value so the user can copy it. Key it by value so a new value
 * starts at "Copy".
 */
export function CopyButton({ text, fallbackRef }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle')

  useEffect(() => {
    if (status === 'idle') {
      return
    }
    const timer = setTimeout(() => {
      setStatus('idle')
    }, CONFIRM_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [status])

  const copy = async () => {
    try {
      // navigator.clipboard is undefined on an insecure origin, so this throws into the fallback.
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      if (fallbackRef.current) {
        window.getSelection()?.selectAllChildren(fallbackRef.current)
      }
      setStatus('selected')
    }
  }

  return (
    <>
      <button
        type="button"
        className="focus-ring -mr-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-function-key active:bg-function-key-border"
        onClick={() => void copy()}
      >
        {status === 'copied' ? <CheckIcon /> : <CopyIcon />}
        {status === 'idle' ? 'Copy' : status === 'copied' ? 'Copied' : 'Selected'}
      </button>
      <span role="status" className="sr-only">
        {ANNOUNCEMENTS[status]}
      </span>
    </>
  )
}
