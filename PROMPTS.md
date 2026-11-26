# Prompts

The brief asks for the prompts used to build this. They are listed below in order. My messages are copied as I wrote them, except where a note in square brackets says otherwise. Each one is followed by a one-line note on what came out of it.

## Tools

- Claude Code (Claude Opus 5.5), used for design discussion, documentation and code.
- Skills: EGM brainstorm (`/egm:egm_brainstorm`) to stress-test the design, readme-optimization to structure the README, and [thermo-nuclear-code-quality-review](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md) to review code before each merge.

I made the design decisions in these conversations. Claude drafted the documents and writes the code under the rules in [CLAUDE.md](CLAUDE.md). I read and reviewed every change.

## Session 1: design (2026-11-26)

### 1

> We will be building a calculator app with microservices. Functionally, it is going to have addition, subtraction, multiplication, division, and, optionally, we will have exponentiation, square root, and percentage, but we can just add them. I don't think they are going to be hard to implement.
> For the frontend, we're going to be using React with a very intuitive UI for entering input and displaying results. We're going to have input validation and error handling. We probably can use Zod for this, and we are going to have a very responsive design. We should at least have basic mobile support, but I'm sure we can just support any type of screen sizes.
> For the UI, we can start with base UI, and we can create our own components on top of it based on design. We can use impeccable design skill with taste design skill to create a beautiful user experience and a very pretty, modern design.
> For now, these are all just talking points that you and I are going to discuss. We can go into details for each step by step.
> From a nonfunctional perspective, we should have clean, readable, and idiomatic code. We have to write unit tests. For both backend and frontend, we have to have good documentation. We will have setup instructions, API usage, and design rationale. We should have a Docker file for full-stack deployment.
> For the cloud, we should focus on Amazon Web Services. There are going to be some constraints:
> - We are going to use React TypeScript for the frontend, and for the backend, Go Lang is preferred here.
> - What we are going to deliver is that we're going to have a GitHub repository for both frontend and backend code. Maybe we can use some sort of a monorepo architecture for the repository itself, with very distinct, separate frontend and backend.
> - We're going to have a proper README.md file with setup instructions, API examples, and design decisions that we are going to make.
> - We're going to have a unit test and a coverage report.
> - We're going to have a Docker file as well to just deploy it full stack.
>
> I think that's it. Now we can discuss further how we should architect this application. Let's talk about diagrams. I really want to have diagrams in our README file as well, and maybe even we can separately work on an API key system. In order to use the calculator, you should generate an API key, then you're going to have to input that API key, and then you're going to be authenticated to use the microservice to the application. Speaking of, since this is going to be a microservice, I think we should also treat it as having a gateway layer too. Maybe we can also think about that as well.
>
> [The assignment brief was pasted here.]
>
> /egm:egm_brainstorm

Outcome: Claude compared the scope with the 2–4 hour brief and recommended one Go service behind nginx, with API keys left out of the build. It also raised floating-point precision, Go's JSON encoder failing on infinity and NaN, the unclear meaning of "percentage", and the need for this file.

### 2

> Yeah, I think you're right. We should not overdeliver this. Now, since you mentioned, let's start this application from the backend, and let's put some rules in its place.
>
> First of all, floating point is actually an issue. It also is encouraged in a fintech business that you do not use floating points because that equation you proposed gives you a trailing number. In the end, that is actually going to turn it into a broken system, a broken result.
>
> Let's lay some ground rules for this application. By ground rules, I mean, let's say, if you are setting up a payment backend system, the first rule I would give is: money never stops, so there are going to be constant transactions of money in a payment backend. We should put certain rules as such into this calculator microservice as well.
>
> The second rule is especially about floating point: we should use a decimal library for it, for example.
>
> And for the AWS and API key system, I just thought about it because I want to display that we can do that too. That's the cleanest way to do a microservice. You would have an API gateway, and through that gateway, you authenticate the user and you rate limit the request before they even reach the microservice. That was my thinking perspective

Outcome: First draft of the ground rules: numbers travel as strings, results are exact or rounded and flagged, every failure is a named error, inputs have limits, and the service is stateless. In the gateway discussion, it was established that API keys identify clients rather than authenticate users, and that key creation itself needs a per-IP limit.

### 3

> Okay, let's keep this gateway logic in mind, but we don't have to implement it. We can just talk about it in our README, probably. Let's put those ground rules into the cloud.md file first so that when we start building it, we are going to follow those ground rules. Now I want to talk about the backend architecture that we're going to use here.  First of all, we are going to be using this skill https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md If you don't have it on the computer, just install it. We are going to run this code quality review skill to check the code that we're going to be writing, okay? And now let's talk about the microservices. Small note about floating numbeR; I would avoid IEEE 754 floating-point arithmetic for financial transactions. Instead, I would represent monetary amounts as 64-bit integers in currency-specific minor units, use fixed-point representations for exchange rates, and arbitrary-precision integers for intermediate calculations. I would enforce explicit rounding policies at monetary boundaries and maintain double-entry accounting invariants at the database level. What do you think about my approach?

Outcome: CLAUDE.md written with the ground rules, and the review skill installed. Claude pointed out gaps in the money approach: amounts smaller than a cent, int64 overflow (which Go does not report), precision loss when inverting exchange rates, splitting amounts so the parts add up, and how double-entry balance is enforced in the database. It also proposed a backend layout with three packages.

### 4

> Okay, thank you. In my own opinion, our microservice should have:
> - an HTTP transport layer
> - routing
> - JSON decoding
> - validation
>
> Then we're going to have a calculator service, which is going to dispatch the operations, and it's going to dispatch domain errors. I think the most important part here is the decimal arithmetic. We should explicitly implement a precision policy and an exact decimal operation system. I think the backend should be the single source of truth for all calculations. React is going to handle the presentation, input, and interaction. We will use Zod for input validation, and I suggest we use just Base UI for a library. You can design it in  Artifacts. For state management, I would rather keep all state in the component unless other components require it. We can use a reducer or Redux. I think a native fetch API for now is enough. For testing, we can use Vitest on the frontend. For backend testing, I think we can use Go's testing and HTTP test, and for arithmetic, we can use ShopSpring Decimal. For deployment, we will use Docker and Docker Compose. And for CI/CD, we can use GitHub Actions. We are going to push this to GitHub. For CSS, let's focus on Tailwind CSS. Let's use that. And we have to use TypeScript with React for the frontend. How do you feel about this architecture? For project structure, let's use a monorepo. We will have a backend and a frontend. The backend will have its own Docker file. The frontend is going to have its own Docker file, but under that, there's going to be a big Docker Compose that is just going to start all of these, ready to deploy wherever. For the arithmetic issue and decimal issue that we might encounter, I can give you this as my choice.
>
> ```go
> a := decimal.RequireFromString("0.1")
> b := decimal.RequireFromString("0.2")
>
> result := a.Add(b)
>
> fmt.Println(result.String())
> // 0.3
> ```
>
> This is from ShopSpring Decimal, so we can use this. For REST API design, I think it's going to be a simple microservice. We can have a POST method with `calculate`, with API versioning, of course. The endpoint should be `API version 1 calculate`, and it's just going to execute the calculation. We should have a second endpoint to check the health of the service.
>
> ```go
> package main
>
> import (
>     "context"
>     "errors"
>     "log/slog"
>     "net/http"
>     "os"
>     "os/signal"
>     "syscall"
>     "time"
> )
>
> func main() {
>     logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
>
>     mux := http.NewServeMux()
>     mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
>         logger.Info("health check", "remote", r.RemoteAddr)
>         w.Header().Set("Content-Type", "application/json")
>         w.Write([]byte(`{"status":"ok"}` + "\n"))
>     })
>
>     srv := &http.Server{
>         Addr:              ":8081",
>         Handler:           mux,
>         ReadHeaderTimeout: 5 * time.Second,
>     }
>
>     ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
>     defer stop()
>
>     go func() {
>         logger.Info("wallet service listening", "addr", srv.Addr)
>         if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
>             logger.Error("server failed", "err", err)
>             os.Exit(1)
>         }
>     }()
>
>     <-ctx.Done()
>     logger.Info("shutting down gracefully")
>
>     shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
>     defer cancel()
>
>     if err := srv.Shutdown(shutdownCtx); err != nil {
>         logger.Error("shutdown failed", "err", err)
>     }
>     logger.Info("server stopped")
> }
> ```
>
> Here is a code snippet that I wrote a couple of days ago that just checks the health, starts the server, and gracefully shuts it down. I think we should handle graceful shutdown as well, just in case the system goes off. Our request should have a JSON file. It has to accept a JSON file, operation, and operands, right? For operation, we're just going to handle all the operations that we had listed, and the response is going to turn us a result: a JSON and result. We should handle all of the error types. I think we should have a generic DTO. For example, if it returns us an error, let's display it like this. Let me just give you
>
> ```json
> {
>   "error": {
>     "code": "DIVISION_BY_ZERO",
>     "message": "Cannot divide by zero."
>   }
> }
> ```
>
> See, it has a code, so we should have different codes for each error so that we can hold them however we want. We can observe them better if we have these. Do you have any issues with this architecture? I think it is pretty simple and solid.

Outcome: A test program showed shopspring's default `Div` returning `0` for `0.000000000000000001 / 3`. The server snippet was reviewed: the Go process must be PID 1 in Docker to receive SIGTERM, `stop()` should be called after the signal arrives, and more server timeouts are needed. Operand-count checks moved into the operation table, each error code got a fixed HTTP status, and `useReducer` was chosen over Redux.

### 5

> I would choose shopspring/decimal for general financial apps and web APIs because its immutable API is much easier and safer to use, while cockroachdb/apd is the better pick for high-performance, high-precision calculations where memory allocations and strict rounding rules matter. I think we should stick with shopspring right now because we do not have to worry about performance or precision calculation, right?

Outcome: shopspring chosen for its immutable API, with our own precision policy (34 significant digits, half-even, one rounding step). A test program confirmed that a division built on `QuoRem` rounds ties correctly. "Percentage" was defined as a% of b.

### 6

> Okay, since that is also settled, before we even start implementing these codes, let's now create our README file first. I think 80% of building a microservice or an application is asking the right questions and having the right answers, and the 20% is just coding. You're going to handle the coding, so let's write up a README file with the diagrams and everything we've talked about so far. We know what we want to build, right?
>
> Let's just draft those diagrams, and I'm going to take a look at the diagram. If I have any more questions, I'm going to address them back to you. Also, I hope you installed that thermonuclear skill that I've just given, because we're going to be running it to test the clarity of our code.

Outcome: README written as the design spec, with five Mermaid diagrams, each rendered and checked. Number limits, error codes and the rules for `power` were set.

### 7

> since ngnix works as api gateway we should say that too, this app does not need API gateway, but since it is a microservice, we used ngnix as a placeholder api gateway

Outcome: The README described nginx as a placeholder gateway. Claude pointed out that nginx answers its own errors with HTML pages, which breaks the JSON error format.

### 8

> why did we use ngnix in the first place?

Outcome: nginx's original jobs: serving the static build and keeping the page and the API on one origin, which means no CORS and no public port on the calculator.

### 9

> yes, keep two containers and add the JSON errors also remove ngnix as apigateway then since it does not make any sense

Outcome: The gateway wording was removed. nginx's own errors now use the JSON format (`SERVICE_UNAVAILABLE`), and `NOT_FOUND` and `METHOD_NOT_ALLOWED` were added for Go's router.

### 10

> is ngnix overenineering? I believe it is not if we are deploying a custom cloud instead of like vercel what do you think

Outcome: nginx kept, because it is needed for the Docker deliverable. In the AWS design, CloudFront does its job instead. This also showed that API Gateway's default error bodies would break the JSON error format in production.

### 11

> yes, add the bullet and set up the repo

Outcome: Production design now maps API Gateway errors to our JSON format. Repository initialised.

### 12

> First lets push the code, then we can start coding

Outcome: Pushed to a private GitHub repo. Built `internal/calc`: the operation table, number rules and precision policy, tested against values from Python's `decimal` module and with a fuzz test.

### 13

> First, set up the docker properly so when I run docker compose up -d it should start the backend.

Outcome: Added the server entry point (`cmd/calculator`, with graceful shutdown and a `-healthcheck` flag), `GET /healthz`, a multi-stage Dockerfile on distroless, and `docker-compose.yml`. Checked that the container reports healthy and that `docker compose stop` shuts it down cleanly with exit code 0.

### 14

> Contiue

Outcome: Added `POST /api/v1/calculate`, with strict JSON decoding (operands must be strings), the error format for every code including JSON 404 and 405 responses, request IDs, panic recovery, and one log line per request. Checked it in the running container with the README's curl examples.

### 15

> Run the code quality review and report back

Outcome: The skill can only be started from its slash command, so a separate reviewer agent was given the skill file and the branch, but none of Claude's reasoning about the code. Verdict: not approved. The two blockers were a silent 500 fallback in the error-to-status mapping, and a banned-call test that misses real violations (shopspring's `Avg`, its formatting globals, float literals) and leaves rule 4 unchecked. The fixes are listed in `stories.md`.

### 16

> Our readme is very bloated,
>
> [Pasted review notes recommending, section by section, what to keep, shorten, remove or move to `docs/`; that the AWS architecture be moved to `docs/production-design.md`; and a list of technical issues: consider cockroachdb/apd, verify Go 1.27.4, drop the API key architecture, keep the `exact` field and shared fixtures, account for non-invertible operations in the fuzz test, prioritise functional tests over CI smoke tests, include measured coverage, and don't describe unimplemented features as completed.]

Outcome: README cut from 422 to 227 lines. It now describes only what is built, with planned parts marked and drawn with dashed lines in the diagram. The frontend and AWS designs moved to `docs/`, and the request and API-key sequence diagrams were removed. Measured coverage was added. The Go version and the fuzz test's handling of rounding, range and multiplication by zero were checked and needed no change.

### 17

> Create stories.md and write down everything we are suppose to implement and tick them one by one.

Outcome: `stories.md` lists every deliverable in build order, with the brief's requirements marked, and ticks only items that are built and verified.

### 18

> [Pasted a target README outline: brief description and screenshot, Quick Start, Local Development, Supported Operations, API, Architecture (one diagram and a short explanation), Design Decisions (decimal precision, string-based numbers, stateless backend, validation and error handling, frontend state management), Testing and Coverage, Assumptions, AI Usage.]
>
> also lets put back microservice architectuer for the service it self

Outcome: README reorganised to that outline. Its single architecture diagram now shows the service's internal layers: request ID, router, the endpoint wrapper and JSON decoding in `httpapi`, then the operation table, number rules and precision policy in `calc`, with the error path back to the wrapper.

### 19

> These findings sound good, fix them

Outcome: Fixed all eight findings and the smaller gaps.
- `httpapi` now has one table from error code to status, checked by a test that reads `calc`'s source, and a 500 logs its real cause.
- Handlers return a body or an error and the wrapper writes both. Every route gets a JSON 405.
- Request keys are exact, and operands are checked from the raw JSON.
- `calc`'s banned-name scan was replaced by a type-checked allowlist that also enforces purity.
- A new fuzz test covers the parse-order invariant, and the body-limit test now pins exactly 4 KiB.
- Checked in the running container.

### 20

> continue

Outcome: Reported the fixes from entry 19, then ran a second review of the whole backend branch. It found no structural problems, plus two input-handling bugs (duplicate keys accepted, some oversized bodies given 400) and several claims in the docs that went further than the code.

### 21

> Feel free to fire up couple more sub agents to work on other stories

Outcome: Started two agents in their own worktrees, on branches built on `feature/backend-core`: one for `power`, `sqrt` and `percentage`, one for the frontend scaffold, Zod number schema, API client and reducer.

### 22

> yes fix them, and agree on both UI answers

Outcome: Fixed every re-review finding.
- The body is read in full and parsed once with `encoding/json/v2`.
- Unclean paths get the JSON 404.
- The purity and status-table tests type-check more cases.
- The range limit is defined once.
- The fuzz test compares results with `math/big`.
- Planned content moved out of the README.

Each new test was checked to fail on the old code. Recorded the `%` key behaviour (pocket-calculator style: `50 + 10 % =` gives `55`) and the long-result display (shrink, then scroll, with a copy button) in `docs/frontend-design.md` and `CLAUDE.md`.

### 23

> yes merge it, and add worktrees to gitignore

Outcome: Fast-forwarded `main` to `feature/backend-core` and added `.claude/worktrees/` to `.gitignore`.

### 24

> allow the mermaid install, and fix the unknown-code handling also we have other subagents ahndlimng otjer stories too communicate and see where the project lies right now I will take alook with you

Outcome: Rendered and checked the frontend state diagram, then pushed `feature/frontend-core` after rebasing it onto `main`. A well-formed error with an unknown code is now kept as an error with the backend's message, not "unreachable". Told the operations agent that `main` had moved, and asked it to rebase. Summarised where the project stands.

### 25

> yes start the visual design artifact

Outcome: With no design system and the "precise instrument" direction (both chosen by the user), drafted a design canvas with three versions as phone screens (Ledger, Graphite, Blueprint) and a sheet of display states. Checked and pushed `feature/optional-operations` after its rebase, adding `percentage` to the `math/big` fuzz reference. Started code reviews of both open branches.

### 26

> lets do A

Outcome: Chose "Ledger" as the visual design. Wrote its spec into `docs/frontend-design.md`: type, colour tokens with contrast checked, layout, keypad, keyboard map and display states. Fixed the dimmed "calculating" colour, which failed contrast in the draft. Closed the last open decision in `CLAUDE.md`.

### 27

> yes fix them, negate the shown result

Outcome: Sent all ten findings from the frontend-core review to the frontend agent. The main ones: the `%` result could be edited by typing; answers were not tied to their request; the no-arithmetic lint check had gaps; broken responses were reported as "unreachable". Decision recorded: the sign key negates a shown result and keeps its rounded flag. Told the UI agent about the coming API changes (`press` in place of `dispatch`, an `invalidResponse` outcome).

### 28

> yes fix them

Outcome: Sent three fixes from the operations review to the operations agent: delete the early out-of-range check in `power`, since it guards against nothing; give `FuzzPower` a `math/big` value check; commit the Python script that produces the expected test values.

### 29

> merge it when it's ready

Outcome: Checked `feature/frontend-core` after its fixes: lint, typecheck, 141 tests at 100% coverage, and the build. It already contained `main`, so `main` fast-forwarded to it. Both test suites pass on `main`.
