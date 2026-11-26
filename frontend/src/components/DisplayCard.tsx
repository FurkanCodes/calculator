import { useRef } from 'react'
import type { DisplayModel, ValueModel } from '../display'
import { CopyButton } from './CopyButton'
import { AlertIcon, NoConnectionIcon } from './icons'
import { ValueText } from './ValueText'

/** The display card: expression line, value, and a footer row for its status. */
export function DisplayCard({ model }: { model: DisplayModel }) {
  const { expression, value } = model
  const textRef = useRef<HTMLSpanElement>(null)
  const failed = value.kind === 'failure'

  return (
    <section
      aria-label="Display"
      aria-busy={value.kind === 'calculating'}
      className={`flex min-h-48 flex-1 flex-col justify-end rounded-[14px] border bg-surface p-5 ${failed ? 'border-error-border' : 'border-hairline'}`}
    >
      <p className="min-h-[1lh] text-right font-mono text-[17px] wrap-anywhere text-muted" data-testid="expression">
        {expression}
      </p>
      <output aria-live="polite" className="mt-1 block">
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
          <ValueText
            text={value.text}
            anchor={value.kind === 'number' ? value.anchor : 'start'}
            dimmed={value.kind === 'calculating'}
            textRef={textRef}
          />
        )}
      </output>
      <div className="mt-2 flex h-11 items-center justify-between gap-2">
        <Footer value={value} textRef={textRef} />
      </div>
    </section>
  )
}

function Footer({ value, textRef }: { value: ValueModel; textRef: React.RefObject<HTMLSpanElement | null> }) {
  switch (value.kind) {
    case 'number':
      return (
        <>
          {value.exact ? <span /> : <RoundedChip />}
          {value.copyable && <CopyButton key={value.text} text={value.text} fallbackRef={textRef} />}
        </>
      )
    case 'calculating':
      return <Calculating />
    case 'failure':
      return <p className="text-sm text-muted">{value.hint}</p>
  }
}

function RoundedChip() {
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-rounded-bg px-2.5 text-[13px] font-medium whitespace-nowrap text-rounded">
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
