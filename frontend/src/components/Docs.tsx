import { ExternalIcon } from './ui/icons'

/**
 * A short guide beside the calculator: what it is, how to use it and how it
 * works, with links to try the API.
 */
export function Docs() {
  return (
    <article id="about" aria-labelledby="about-title" className="max-w-[68ch] scroll-mt-6 text-[15px] leading-relaxed text-ink">
      <h2 id="about-title" className="text-[22px] leading-tight font-semibold">
        About this calculator
      </h2>
      <p className="mt-3">
        A calculator with exact decimals: <Code>0.1 + 0.2</Code> is <Code>0.3</Code>. A result that had to be
        rounded, such as <Code>1 ÷ 3</Code>, is marked as rounded.
      </p>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <NewTabLink href="/docs/">API docs (Swagger UI)</NewTabLink>
        </li>
        <li>
          <NewTabLink href="/api/v1/openapi.json">OpenAPI description</NewTabLink>
        </li>
        <li>
          <NewTabLink href="https://github.com/FurkanCodes/calculator">Source on GitHub</NewTabLink>
        </li>
      </ul>

      <Section title="Using it">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-dimmed">
          <li>
            One operation at a time, left to right, like a pocket calculator: <Code>2 + 3 × 4</Code> is{' '}
            <Code>20</Code>.
          </li>
          <li>
            <Code>50 + 10 %</Code> turns the 10 into 5 (10% of 50), so <Code>=</Code> gives <Code>55</Code>. On its
            own, <Code>10 %</Code> is <Code>0.1</Code>.
          </li>
          <li>
            Numbers have up to 34 significant digits. <Code>xʸ</Code> takes whole exponents from −1000 to 1000.
          </li>
          <li>
            Keyboard: digits, <Kbd>.</Kbd> <Kbd>+</Kbd> <Kbd>-</Kbd> <Kbd>*</Kbd> <Kbd>/</Kbd> <Kbd>^</Kbd>{' '}
            <Kbd>%</Kbd>, then <Kbd>Enter</Kbd> or <Kbd>=</Kbd>. <Kbd>Esc</Kbd> or <Kbd>Delete</Kbd> clears.
          </li>
        </ul>
      </Section>

      <Section title="How it works">
        <p>
          The React app sends each calculation to a Go service, which does the arithmetic and sends back the result.
          nginx serves the page and forwards the API, so both share one address. Numbers travel as text, never as
          floating point, so nothing is lost on the way.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h3 className="mb-3 text-[17px] font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function NewTabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="link inline-flex items-center gap-1.5 font-medium" href={href} target="_blank" rel="noopener">
      {children}
      <ExternalIcon className="size-3.5" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[4px] bg-function-key px-1 py-px font-mono text-[0.88em] whitespace-nowrap">{children}</code>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[4px] border border-function-key-border bg-surface px-1.5 py-px font-mono text-[0.85em]">
      {children}
    </kbd>
  )
}
