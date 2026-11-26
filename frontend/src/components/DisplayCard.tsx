import { useRef } from 'react'
import type { DisplayModel, ValueModel } from '../calculator/display'
import { CopyButton } from './ui/CopyButton'
import { AlertIcon, NoConnectionIcon } from './ui/icons'
import { ValueText } from './ui/ValueText'

export function DisplayCard({ model }: { model: DisplayModel }) {
  const { expression, value } = model
  const textRef = useRef<HTMLSpanElement>(null)
  const failed = value.kind === 'failure'

  return (
    <section
      aria-label="Display"
      aria-busy={value.kind === 'number' && value.dimmed}
      className={`flex flex-auto flex-col justify-end rounded-[14px] border bg-surface p-5 ${failed ? 'border-error-border' : 'border-hairline'}`}
    >
      <Expression text={expression} />
      <div role="status" aria-live="polite" className="mt-1">
        {value.kind === 'failure' ? (
          <p className="py-1 text-right text-xl leading-snug font-medium text-balance text-error">
            {value.reason === 'unreachable' ? (
              <NoConnectionIcon className="mr-2 inline size-6 align-[-0.3em]" />
            ) : (
              <AlertIcon className="mr-2 inline size-6 align-[-0.3em]" />
            )}
            {value.message}
          </p>
        ) : (
          <>
            <ValueText text={value.text} anchor={value.anchor} dimmed={value.dimmed} textRef={textRef} />
            {!value.exact && <span className="sr-only">, rounded to 34 significant digits</span>}
          </>
        )}
      </div>
      <div className="mt-1 flex h-11 items-center justify-between gap-2">
        <Footer value={value} textRef={textRef} />
      </div>
    </section>
  )
}

/**
 * dir="rtl" puts the ellipsis on the left, so a long expression keeps its
 * operator or = in view. The inner span keeps the text itself left to right.
 */
function Expression({ text }: { text: string }) {
  return (
    <p
      dir="rtl"
      title={text || undefined}
      className="min-h-[1lh] truncate font-mono text-[17px] text-muted"
      data-testid="expression"
    >
      <span dir="ltr">{text}</span>
    </p>
  )
}

function Footer({ value, textRef }: { value: ValueModel; textRef: React.RefObject<HTMLSpanElement | null> }) {
  if (value.kind === 'failure') {
    return <p className="text-sm text-muted">{value.hint}</p>
  }
  if (value.dimmed) {
    return <Calculating />
  }
  return (
    <>
      {value.exact ? <span /> : <RoundedChip />}
      {value.copyable && <CopyButton key={value.text} text={value.text} fallbackRef={textRef} />}
    </>
  )
}

function RoundedChip() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-7 items-center rounded-full bg-rounded-bg px-2.5 text-[13px] font-medium whitespace-nowrap text-rounded"
    >
      ≈ Rounded to 34 digits
    </span>
  )
}

function Calculating() {
  return (
    <span className="appear-late inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden="true" className="inline-flex gap-1">
        <span className="calculating-dot size-1.5 rounded-full bg-current" />
        <span className="calculating-dot size-1.5 rounded-full bg-current" />
        <span className="calculating-dot size-1.5 rounded-full bg-current" />
      </span>
      Calculating…
    </span>
  )
}
