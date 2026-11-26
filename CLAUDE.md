# Calculator

Take-home assignment: a React + TypeScript calculator that calls a Go REST service. The brief allows 2–4 hours and ranks correctness, clarity and maintainability above extra features. When the choice is between another feature and a tighter core, pick the core.

`README.md` describes only what is built, never planned work as if it were done. Everything still to build is a checklist in `stories.md`; planned designs live in `docs/` and in the rules below. When an item is built and verified, tick it in `stories.md` and move its description into the README in the same commit.

## Scope

- One Go service (`backend/`) and one React app (`frontend/`) in one repo.
- Operations: `add`, `subtract`, `multiply`, `divide`. Then `power`, `sqrt` and `percentage`, once the core is done and tested.
- Designed in `docs/production-design.md` only, never built: the API gateway, API keys, rate limiting and the AWS deployment.
- Docker Compose runs two containers: `web` and `calculator`. In `web`, nginx serves the built frontend and forwards `/api/*` to the service, so the page and the API share one origin. nginx is not an API gateway: don't describe it as one. The calculator has no public port. `web` is published on `127.0.0.1:8080`, and it is the only way in.

## Architecture

### Backend (Go: standard library plus `shopspring/decimal`)

- `cmd/calculator`: reads `PORT` (default 8081), wires the server, handles SIGTERM. `main` only calls `run(ctx) error`, so startup and shutdown can be tested. A `-healthcheck` flag calls `/healthz` and exits 0 or 1, for the Compose health check in an image with no shell.
- `internal/httpapi`: transport. Routing, JSON decoding, request shape checks (body size, valid JSON, no unknown fields, `operation` is a string, `operands` is an array of strings), and error-to-status mapping. API handlers return a success body or an error and never write the response; one `endpoint` wrapper applies the body limit, recovers panics, writes the response and logs one line per request (request ID, status, code, duration, and the cause on a 500). Every route is registered with `route`, which adds a JSON 405 for the other methods. A path not in clean form (`/api/v1//calculate`) gets the JSON 404 instead of Go's plain-text redirect. The body is read in full, then parsed once with `encoding/json/v2`, so an oversized body is always 413 and duplicate keys or trailing data are rejected. Request keys are matched exactly. A request-ID middleware wraps everything. `/healthz` sits outside the wrapper, so it is not logged. It never imports the decimal library, and a test checks that.
- `internal/calc`: the calculator. Operation table (name, operand count, function), number parsing and limits, the precision policy, and domain errors. It takes the operands as raw strings and returns the result as a string.
- Endpoints: `POST /api/v1/calculate`, `GET /healthz`, and `GET /api/v1/openapi.json`, the hand-written OpenAPI 3.1 description. Contract tests in `httpapi` fail when it and the code disagree.
- Request: `{"operation": "divide", "operands": ["10", "4"]}`. Success: `200 {"result": "2.5", "exact": true}`. `exact` is always present.
- Error: `{"error": {"code": "DIVISION_BY_ZERO", "message": "Cannot divide by zero."}}`.

### Operation semantics

- `percentage`: a% of b, which is a × b ÷ 100.
- `power`: integer exponents from −1000 to 1000 only. `0^0` is `1`. Zero to a negative power is `DIVISION_BY_ZERO`.
- `sqrt`: one operand. A negative operand is `NEGATIVE_SQUARE_ROOT`.

### Frontend (React + TypeScript)

- Base UI components styled with Tailwind CSS.
- Input model: one operation at a time, evaluated left to right. The backend computes every result, and the frontend never does arithmetic.
- The `%` key: after `a + b`, `%` sends `percentage(b, a)` and the result replaces `b` (so `50 + 10 % =` gives `55`). With no operator chosen, `x %` sends `percentage(x, 1)`, which is x ÷ 100. Right after an operator, `%` is ignored.
- Long results: the display shrinks the text down to a minimum size, then scrolls horizontally. A copy button copies the full value.
- State stays in the component that uses it. The calculator's state machine is a `useReducer` with a pure reducer (states as in the README diagram).
- Zod validates both user input and API responses. Native `fetch`. Tests use Vitest and React Testing Library.

### Tooling

A Dockerfile per app, a root `docker-compose.yml`, and GitHub Actions CI (lint, test, coverage, image build).

## Ground rules

Each rule needs a test or a lint check behind it. A rule with no check is not done.

1. **No floats where numbers pass through.** No `float32`, `float64` or `strconv.ParseFloat` in the backend number path. The frontend does no arithmetic: it validates strings and displays them. Check: `calc/rules_test.go` type-checks the package and fails on any value of float type, including untyped literals.
2. **Numbers travel as strings.** Operands and results are JSON strings (`"0.1"`), never JSON numbers, in both requests and responses. A JSON number in a request is rejected with `INVALID_NUMBER`.
3. **Results are exact, or rounded and flagged.** Math uses `github.com/shopspring/decimal`, chosen for its immutable API. Its defaults round to a fixed number of decimal places, so small results silently become 0 (`0.000000000000000001 / 3` and `Sqrt(1e-40)` both return 0). `internal/calc` therefore owns one precision policy: 34 significant digits, half-even rounding, one rounding step per result. No other code rounds.
   - Add, subtract and multiply are exact in shopspring: compute, then round once to 34 significant digits with `RoundBank`.
   - Divide uses `QuoRem` at a computed number of decimal places and rounds half-even from the remainder.
   - Percentage multiplies, then moves the decimal point two places, which is exact; it rounds like multiply.
   - Square root takes the exact integer root of the operand scaled to 34 result digits, and rounds once from the remainder. A tie is impossible.
   - Power is computed exactly by repeated squaring and rounded once; a negative exponent divides 1 by the positive power under the divide policy.
   - `exact` is `false` when the policy changed the result.
   - `calc` may use only the shopspring functions on the allowlist in `calc/rules_test.go`. That keeps out the ones that round on their own (`Div`, `Avg`, `Round`, `Sqrt`, `Pow*` and the rest), the package-wide settings (`DivisionPrecision`, `UseScientificNotation`, `TrimTrailingZeros`) and the `Require*` constructors, which panic. Adding a name to the allowlist is a deliberate change.
   - Request types hold operands as `string`, never `decimal.Decimal`: its JSON decoder silently accepts bare JSON numbers, which breaks rule 2.
4. **Same input, same output.** `internal/calc` is pure: no I/O, no mutable globals, no clock, no logging. The same rules test allows only named functions and methods from pure packages, allows only the package-level variables in `allowedGlobals`, and fails on a direct write to one: assignment, `++`/`--`, `delete`, `clear`, or taking its address. A write through a copied map reference is not caught, which is why the list of package-level variables is kept short. Table-driven tests cover every operation and every error.
5. **Every failure is a named error with one status.**
   - 400: `INVALID_REQUEST`, `INVALID_NUMBER`, `WRONG_OPERAND_COUNT`, `UNSUPPORTED_OPERATION`.
   - 404: `NOT_FOUND`. 405: `METHOD_NOT_ALLOWED`. Go's router answers these in plain text by default, so register catch-all routes that return the JSON format.
   - 413: `INPUT_TOO_LARGE`.
   - 422: `DIVISION_BY_ZERO`, `NEGATIVE_SQUARE_ROOT`, `INVALID_EXPONENT`, `OUT_OF_RANGE`.
   - 500: `INTERNAL_ERROR`, which means a bug. Panics are recovered, logged at error level with the request ID, and return a generic message.
   - 503: `SERVICE_UNAVAILABLE`, sent only by nginx. nginx's own errors use the same JSON format: 502, 503 and 504 become `SERVICE_UNAVAILABLE`, and its 413 becomes `INPUT_TOO_LARGE`. A CI smoke test stops the calculator and expects the JSON 503.
   - One table in `httpapi` (`statuses`) maps every code to its status; nothing else sets a status for an error. A test type-checks `calc` and collects every constant of type `Code`, so no calc code can be missing. At run time an unmapped code becomes `INTERNAL_ERROR`, with the original error logged as the cause.
   - Domain errors are logged at info level with their code as a field, never at error level.
6. **Inputs have limits, defined in one place, each with a test.**
   - Request body: 4 KiB.
   - An operand is at most 256 characters. Longer is `INPUT_TOO_LARGE`.
   - A number is a plain decimal matching `^-?[0-9]+(\.[0-9]+)?$`: no `+`, exponent, spaces, or leading or trailing dot. Anything else is `INVALID_NUMBER`.
   - At most 34 significant digits, counted from the first non-zero digit to the last. More is `INPUT_TOO_LARGE`.
   - Zero, or a magnitude of at least 10⁻¹⁰⁰ and less than 10¹⁰⁰ (`maxMagnitude` in `number.go`). An operand or result outside this is `OUT_OF_RANGE`.
7. **Every result is a valid operand.** Results follow the same number rules as inputs, so any result can be sent back. A test feeds results back in as operands.
8. **One number format on both sides.** `testdata/numbers.json` lists accepted and rejected number strings. The Go tests and the Vitest tests both run against it.
9. **Stateless and replaceable.** `GET /healthz` reports that the process is up and is not logged. On SIGTERM the server stops accepting connections and finishes in-flight requests within 5 seconds, which is under Docker's 10-second stop grace period. The Dockerfile uses an exec-form `ENTRYPOINT` so the signal reaches the Go process.
10. **The backend validates everything itself.** Zod validation in the frontend is there to help the user. The backend never relies on it.

## Code quality

- Before merging a feature branch, run `/thermo-nuclear-code-quality-review` on its diff and fix the structural findings first.
- Standard library first. Every added dependency needs a reason in the README's design decisions.

## Deliverables

- README: setup, how to run the frontend and backend, curl examples for the API, design decisions and assumptions, Mermaid diagrams. Before submitting, run every README command from a clean checkout.
- Unit tests for both layers, with coverage reports.
- A Dockerfile per app and a root `docker-compose.yml`.
- `PROMPTS.md` with the prompts used to build this, as the brief asks.

## Open decisions

None. The visual design ("Ledger") is specified in `docs/frontend-design.md`.
