import { ExternalIcon } from './ui/icons'

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

      <Section title="How it works">
        <p>
          The React app sends each calculation to a Go service, which does the arithmetic and sends back the result.
          nginx serves the page and forwards the API, so both share one address. Numbers travel as text, never as
          floating point, so nothing is lost on the way.
        </p>
      </Section>

      <Section title="Why it's built this way">
        <Points>
          <li>
            <Lead>No floating point.</Lead> Computers store most decimals as binary fractions, which can't hold 0.1
            exactly. That's why JavaScript says <Code>0.1 + 0.2</Code> is <Code>0.30000000000000004</Code>. The Go
            service does its math with an exact decimal library, and
            numbers travel as text, so nothing turns them into floating point on the way.
          </li>
          <li>
            <Lead>The service does all the math.</Lead> The app never calculates anything itself. It checks what you
            type so you get quick feedback, and the service checks everything again. One place doing the math means one
            place to test.
          </li>
          <li>
            <Lead>One endpoint for every operation.</Lead> The app sends the operation's name and its numbers to{' '}
            <Code>POST /api/v1/calculate</Code>. Every operation shares the same checks and the same error format, and
            adding one to the service is a row in a table.
          </li>
          <li>
            <Lead>nginx in front.</Lead> It serves the page and passes API calls to the service, so the browser talks
            to one address. The Go service can't be reached from outside at all.
          </li>
        </Points>
      </Section>
    </article>
  )
}

function Points({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-dimmed">{children}</ul>
}

function Lead({ children }: { children: React.ReactNode }) {
  return <span className="font-medium">{children}</span>
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
