# Prompts

The brief asks for the prompts used. Every prompt is below, in order and as typed, typos included; square brackets mark a long paste that is summarised. Each is followed by a one-line result.

## How AI was used

- **Tool:** Claude Code (Claude Opus 5.5) for design discussion, documentation and code.
- **Workflow:** I made the design decisions; Claude drafted documents and wrote code under the rules in [CLAUDE.md](CLAUDE.md). Larger pieces were built on separate branches by parallel agents. Each branch that changed calculation or API behaviour got an independent code review ([thermo-nuclear-code-quality-review](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md)) before merging. I read, reviewed and tested every change.
- **Skills:** thermo-nuclear code quality review to keep the code clean, EGM brainstorm to stress-test the design, and readme-optimization for the README.

## Design

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

Scope set against the 2–4 hour brief: one Go service behind nginx, API keys and a gateway documented but not built. Open questions raised: floating-point precision, what "percentage" means, and keeping this prompt log.

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

First ground rules: numbers travel as strings, results are exact or rounded and flagged, every failure is a named error, inputs have limits, the service is stateless.

### 3

> Okay, let's keep this gateway logic in mind, but we don't have to implement it. We can just talk about it in our README, probably. Let's put those ground rules into the cloud.md file first so that when we start building it, we are going to follow those ground rules. Now I want to talk about the backend architecture that we're going to use here.  First of all, we are going to be using this skill https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md If you don't have it on the computer, just install it. We are going to run this code quality review skill to check the code that we're going to be writing, okay? And now let's talk about the microservices. Small note about floating numbeR; I would avoid IEEE 754 floating-point arithmetic for financial transactions. Instead, I would represent monetary amounts as 64-bit integers in currency-specific minor units, use fixed-point representations for exchange rates, and arbitrary-precision integers for intermediate calculations. I would enforce explicit rounding policies at monetary boundaries and maintain double-entry accounting invariants at the database level. What do you think about my approach?

Ground rules written to `CLAUDE.md`; review skill installed. Discussed the money-handling approach (sub-cent amounts, overflow, exchange-rate precision) and settled on a three-package backend.

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

Architecture agreed: transport, calculator and precision policy as separate layers; one error format with a fixed status per code; `useReducer` for frontend state; graceful shutdown with the Go process as PID 1.

### 5

> I would choose shopspring/decimal for general financial apps and web APIs because its immutable API is much easier and safer to use, while cockroachdb/apd is the better pick for high-performance, high-precision calculations where memory allocations and strict rounding rules matter. I think we should stick with shopspring right now because we do not have to worry about performance or precision calculation, right?

shopspring/decimal chosen, with our own precision policy: 34 significant digits, half to even, rounded once. "Percentage" defined as a% of b.

### 6

> Okay, since that is also settled, before we even start implementing these codes, let's now create our README file first. I think 80% of building a microservice or an application is asking the right questions and having the right answers, and the 20% is just coding. You're going to handle the coding, so let's write up a README file with the diagrams and everything we've talked about so far. We know what we want to build, right?
>
> Let's just draft those diagrams, and I'm going to take a look at the diagram. If I have any more questions, I'm going to address them back to you. Also, I hope you installed that thermonuclear skill that I've just given, because we're going to be running it to test the clarity of our code.

README drafted as the design spec, with Mermaid diagrams; number limits, error codes and the rules for `power` set.

### 7

> since ngnix works as api gateway we should say that too, this app does not need API gateway, but since it is a microservice, we used ngnix as a placeholder api gateway

Discussed nginx's role and its HTML error pages.

### 8

> why did we use ngnix in the first place?

nginx's role clarified: serve the build and keep page and API on one origin (no CORS, no public port on the service).

### 9

> yes, keep two containers and add the JSON errors also remove ngnix as apigateway then since it does not make any sense

Two containers kept; nginx's own errors use the JSON format; JSON 404 and 405 added.

### 10

> is ngnix overenineering? I believe it is not if we are deploying a custom cloud instead of like vercel what do you think

nginx kept for the Docker deliverable; in the AWS design CloudFront does its job.

### 11

> yes, add the bullet and set up the repo

Production design maps API Gateway errors to the JSON format. Repository initialised.

## Backend

### 12

> First lets push the code, then we can start coding

Pushed to GitHub. Built the calculator core: operation table, number rules and precision policy, tested against Python's `decimal` module and with a fuzz test.

### 13

> First, set up the docker properly so when I run docker compose up -d it should start the backend.

Server entry point with graceful shutdown and a health check, a distroless multi-stage Dockerfile, and Compose. Verified healthy start and clean stop.

### 14

> Contiue

`POST /api/v1/calculate` with strict JSON decoding, the error format for every code, request IDs, panic recovery and request logging. Verified with the README's curl examples.

### 15

> Run the code quality review and report back

Independent code review of the backend branch; its findings were listed in `stories.md`.

### 16

> Our readme is very bloated,
>
> [Pasted review notes recommending, section by section, what to keep, shorten, remove or move to `docs/`; that the AWS architecture be moved to `docs/production-design.md`; and a list of technical issues: consider cockroachdb/apd, verify Go 1.27.4, drop the API key architecture, keep the `exact` field and shared fixtures, account for non-invertible operations in the fuzz test, prioritise functional tests over CI smoke tests, include measured coverage, and don't describe unimplemented features as completed.]

README cut to what is built; planned frontend and AWS designs moved to `docs/`; measured coverage added.

### 17

> Create stories.md and write down everything we are suppose to implement and tick them one by one.

`stories.md` created: every deliverable in build order, ticked only when built and verified.

### 18

> [Pasted a target README outline: brief description and screenshot, Quick Start, Local Development, Supported Operations, API, Architecture (one diagram and a short explanation), Design Decisions (decimal precision, string-based numbers, stateless backend, validation and error handling, frontend state management), Testing and Coverage, Assumptions, AI Usage.]
>
> also lets put back microservice architectuer for the service it self

README reorganised to that outline, with one diagram of the service's internal layers.

### 19

> These findings sound good, fix them

Review findings fixed: one error-to-status table checked by a test, a type-checked purity and allowlist test for `calc`, JSON 405 on every route, exact request keys.

### 20

> continue

Second review of the backend branch; its findings fixed in entry 22.

## Optional operations and frontend

### 21

> Feel free to fire up couple more sub agents to work on other stories

Work split across parallel agents in separate branches: the optional operations, and the frontend core (scaffold, Zod schema, API client, reducer).

### 22

> yes fix them, and agree on both UI answers

Re-review findings fixed (body parsed once with `encoding/json/v2`, duplicate keys rejected, `math/big` reference in the fuzz test). Recorded the `%` key behaviour and the long-result display.

### 23

> yes merge it, and add worktrees to gitignore

Backend merged into `main`.

### 24

> allow the mermaid install, and fix the unknown-code handling also we have other subagents ahndlimng otjer stories too communicate and see where the project lies right now I will take alook with you

State diagram rendered and checked; an unknown error code now shows the backend's message. Status review of all branches.

### 25

> yes start the visual design artifact

Visual design drafted as a canvas: three versions plus the display states. Optional operations checked and pushed; reviews started on both open branches.

### 26

> lets do A

"Ledger" chosen; its spec (type, colour tokens with contrast checked, layout, keypad, keyboard map, states) written to `docs/frontend-design.md`.

### 27

> yes fix them, negate the shown result

Frontend review fixes: a `%` result is replaced by the next digit, answers are tied to their request, the no-arithmetic lint rule widened, contract-breaking responses get their own state. The sign key negates a shown result.

### 28

> yes fix them

Operations review fixes: a needless early range check removed, `power` fuzzed against `math/big`, and the Python script that produces the expected test values committed.

### 29

> merge it when it's ready

Frontend core and optional operations checked and merged into `main`.

## Docker, API docs and CI

### 30

> yes please, after that I think it is time to write up the docker file to run both backend and frontend.

UI review fixes (keys flex to fit small phones, one-line expression, screen readers hear "rounded", one key table); UI merged. Web container started.

### 31

> yes, but also please give us backend API ui as well, use openapi.

Web container review fixes (strict CSP, one request-ID header, shorter proxy timeouts) and merge. OpenAPI 3.1 spec served by the backend with contract tests, and Swagger UI at `/docs/`.

### 32

> I feel like we are starting to over-engineer this.

Scope tightened: fix only what is wrong or untrue, one CI workflow, full reviews only for calculation or API changes.

### 33

> yes go ahead with the slimmed plan

Restated with more detail as the next prompt.

### 34

> yes go ahead with the slimmed plan and do the final check and and report back to me on the requirements we were asked, update the stories and lets see if we have finished product

OpenAPI fixes merged. CI added (backend and frontend tests with coverage, and a Compose smoke test). Final check against the brief.

## Submission

### 35

> public, trim read me, do not do a lot of words, stick with simple yet effective readme. keep aws in product design.

README cut to 142 lines; detail moved to `docs/design.md`, the AWS design kept in `docs/production-design.md`. Repository made public.

### 36

> [Pasted the assignment brief from the recruiting email: the objective, functional and non-functional requirements, constraints, deliverables and instructions.]

Checked against every line of the brief; added the rationale for the single `POST /api/v1/calculate` endpoint.

### 37

> tidy up the prompts, do not display our incompetency lol

This file reorganised into phases with shorter result notes. The prompts themselves are unchanged.

### 38

> Other skills: EGM brainstorm to stress-test the design, and readme-optimization for the README. please state that we also use  nuclear code review for clean code

The skills line now lists the thermo-nuclear code quality review first.

### 39

> what ı DONT understand is why do we have same ports for both abckend and frontend? they should be seperate apps right

Explained: two separate containers. The Go service listens on 8081 inside Docker's network only; nginx on 8080 serves the React build and forwards `/api/*`, giving one origin.

### 40

> are these the reasons we used nGNIX?

Confirmed the four reasons from the design phase, and the alternative of serving the build from Go.

### 41

> add the nginx reasons to the readme

Added a "nginx in front, two containers" design decision to the README.
