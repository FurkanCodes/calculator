import { ExternalIcon } from './icons'

const REPO = 'https://github.com/FurkanCodes/calculator'

/**
 * A short readme beside the calculator: what it is, how to use it, how it
 * works and why it is built this way, with links to try the API.
 */
export function Docs() {
  return (
    <article id="about" aria-labelledby="about-title" className="max-w-[68ch] scroll-mt-6 text-[15px] leading-relaxed text-ink">
      <h2 id="about-title" className="text-[22px] leading-tight font-semibold">
        About this calculator
      </h2>
      <p className="mt-3">
        The arithmetic happens on a Go service, in exact decimals. <Code>0.1 + 0.2</Code> is <Code>0.3</Code>, and a
        result that had to be rounded, such as <Code>1 ÷ 3</Code>, is marked{' '}
        <span className="rounded-full bg-rounded-bg px-2 py-0.5 text-[13px] font-medium whitespace-nowrap text-rounded">
          ≈ Rounded to 34 digits
        </span>
        .
      </p>

      <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <NewTabLink href="/docs/">API docs (Swagger UI)</NewTabLink>
        </li>
        <li>
          <NewTabLink href="/api/v1/openapi.json">OpenAPI description</NewTabLink>
        </li>
        <li>
          <NewTabLink href={REPO}>Source on GitHub</NewTabLink>
        </li>
      </ul>
      <p className="mt-2 text-[13px] text-muted">
        In Swagger UI, “Try it out” sends real requests to the service. It is served by the Docker setup, not by{' '}
        <Code>npm run dev</Code>.
      </p>

      <Section title="Using it">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-dimmed">
          <li>
            One operation at a time, left to right, like a pocket calculator: <Code>2 + 3 × 4</Code> is{' '}
            <Code>20</Code>.
          </li>
          <li>
            <Code>%</Code> works on the number you just typed. <Code>50 + 10 %</Code> turns the 10 into 5 (10% of
            50), so <Code>=</Code> gives <Code>55</Code>. On its own, <Code>10 %</Code> is <Code>0.1</Code>.
          </li>
          <li>
            <Code>±</Code> changes the sign of the number being typed, or of the result. <Code>xʸ</Code> takes whole
            exponents from −1000 to 1000.
          </li>
          <li>
            Numbers have up to 34 significant digits. Results with more are rounded once, half to even, and marked.
          </li>
          <li>
            Keyboard: digits, <Kbd>.</Kbd> <Kbd>+</Kbd> <Kbd>-</Kbd> <Kbd>*</Kbd> <Kbd>/</Kbd> <Kbd>^</Kbd>{' '}
            <Kbd>%</Kbd>, then <Kbd>Enter</Kbd> or <Kbd>=</Kbd>. <Kbd>Esc</Kbd> or <Kbd>Delete</Kbd> clears.
          </li>
        </ul>
      </Section>

      <Section title="How it works">
        <p>
          The page is a React app. Each key goes through a small state machine, and when an answer is needed it sends
          one request:
        </p>
        {/* Focusable, so the keyboard can scroll it sideways on a phone. */}
        <pre tabIndex={0} aria-label="Example request and response" className="focus-ring mt-3 overflow-x-auto rounded-[10px] border border-hairline bg-surface p-4 font-mono text-[13px] leading-relaxed">
          {`POST /api/v1/calculate
{"operation": "divide", "operands": ["1", "3"]}

200 {"result": "0.3333333333333333333333333333333333",
     "exact": false}`}
        </pre>
        <p className="mt-3">
          nginx serves the page and forwards <Code>/api/</Code> to the Go service, so both share one origin. The
          service does the arithmetic and sends the result back as a string; <Code>exact</Code> says whether it was
          rounded. Errors have one shape, such as <Code>DIVISION_BY_ZERO</Code>, and the app picks its message from
          the code.
        </p>
      </Section>

      <Section title="Why it is built this way">
        <dl className="space-y-3">
          <Decision term="Numbers are strings.">
            A JSON number becomes a float in the browser, where <Code>0.1 + 0.2</Code> is{' '}
            <Code>0.30000000000000004</Code>. Operands and results travel as strings, the API rejects JSON numbers, and
            the browser does no arithmetic at all: a lint rule enforces it.
          </Decision>
          <Decision term="Exact, or rounded once and flagged.">
            Results keep 34 significant digits. Only the service rounds, in one place, and <Code>exact: false</Code>{' '}
            tells you it did.
          </Decision>
          <Decision term="One endpoint.">
            The operation is named in the body, so every operation shares one request shape, one validation path and
            one error format. Adding one is a row in a table.
          </Decision>
          <Decision term="nginx in front.">
            One origin means no CORS and no backend URL in the app. The Go service has no public port, and when it is
            down nginx still answers with a JSON error.
          </Decision>
          <Decision term="The service checks everything.">
            The app checks numbers too, but only for quick feedback. Both sides test against the same list of
            accepted and rejected numbers.
          </Decision>
        </dl>
      </Section>

      <Section title="How it was built">
        <p>
          Ten ground rules came first, each backed by a test or a lint check, such as “no floats where numbers pass
          through”. Then the operations, tested against Python’s <Code>decimal</Code> module and fuzzed against Go’s{' '}
          <Code>math/big</Code>; then the HTTP API, this interface, Docker and CI; and last the OpenAPI description, with
          contract tests that fail when it and the code disagree. It was built with Claude Code, and every prompt is in{' '}
          <NewTabLink href={`${REPO}/blob/main/PROMPTS.md`}>PROMPTS.md</NewTabLink>
          .
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

function Decision({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-medium">{term}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
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
