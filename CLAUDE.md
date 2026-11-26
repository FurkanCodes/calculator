# Calculator

Take-home assignment: a React + TypeScript calculator that calls a Go REST service. The brief allows 2–4 hours and ranks correctness, clarity and maintainability above extra features. When the choice is between another feature and a tighter core, pick the core.

`README.md` is the spec. If code and README disagree, fix one of them before merging.

## Scope

- One Go service (`backend/`) and one React app (`frontend/`) in one repo.
- Operations: `add`, `subtract`, `multiply`, `divide`. Then `power`, `sqrt` and `percentage`, once the core is done and tested.
- Described in the README only, not built: the API gateway, API keys, rate limiting and the AWS deployment.
- Docker Compose runs two containers: `web` and `calculator`. In `web`, nginx serves the built frontend and forwards `/api/*` to the service, so the page and the API share one origin. nginx is not an API gateway: don't describe it as one. The calculator has no public port. Until the `web` container exists, `docker-compose.yml` publishes it on `127.0.0.1:8081` only; remove that mapping when `web` is added.

## Architecture

### Backend (Go: standard library plus `shopspring/decimal`)

- `cmd/calculator`: reads `PORT` (default 8081), wires the server, handles SIGTERM. `main` only calls `run(ctx) error`, so startup and shutdown can be tested. A `-healthcheck` flag calls `/healthz` and exits 0 or 1, for the Compose health check in an image with no shell.
- `internal/httpapi`: transport. Routing, JSON decoding, request shape checks (body size, valid JSON, no unknown fields, `operation` is a string, `operands` is an array of strings), and error-to-status mapping. API handlers return their error instead of writing it; one `endpoint` wrapper applies the body limit, recovers panics, writes the JSON error and logs one line per request (request ID, status, code, duration). A request-ID middleware wraps everything. `/healthz` sits outside the wrapper, so it is not logged. It never imports the decimal library, and a test checks that.
- `internal/calc`: the calculator. Operation table (name, operand count, function), number parsing and limits, the precision policy, and domain errors. It takes the operands as raw strings and returns the result as a string.
- Endpoints: `POST /api/v1/calculate` and `GET /healthz`.
- Request: `{"operation": "divide", "operands": ["10", "4"]}`. Success: `200 {"result": "2.5", "exact": true}`. `exact` is always present.
- Error: `{"error": {"code": "DIVISION_BY_ZERO", "message": "Cannot divide by zero."}}`.

### Operation semantics

- `percentage`: a% of b, which is a × b ÷ 100.
- `power`: integer exponents from −1000 to 1000 only. `0^0` is `1`. Zero to a negative power is `DIVISION_BY_ZERO`.
- `sqrt`: one operand. A negative operand is `NEGATIVE_SQUARE_ROOT`.

### Frontend (React + TypeScript)

- Base UI components styled with Tailwind CSS.
- Input model: one operation at a time, evaluated left to right. The backend computes every result, and the frontend never does arithmetic.
- State stays in the component that uses it. The calculator's state machine is a `useReducer` with a pure reducer (states as in the README diagram).
- Zod validates both user input and API responses. Native `fetch`. Tests use Vitest and React Testing Library.

### Tooling

A Dockerfile per app, a root `docker-compose.yml`, and GitHub Actions CI (lint, test, coverage, image build).

## Ground rules

Each rule needs a test or a lint check behind it. A rule with no check is not done.

1. **No floats where numbers pass through.** No `float32`, `float64` or `strconv.ParseFloat` in the backend number path. The frontend does no arithmetic: it validates strings and displays them. Check: a test that fails if `backend/internal/calc` uses a float type.
2. **Numbers travel as strings.** Operands and results are JSON strings (`"0.1"`), never JSON numbers, in both requests and responses. A JSON number in a request is rejected with `INVALID_NUMBER`.
3. **Results are exact, or rounded and flagged.** Math uses `github.com/shopspring/decimal`, chosen for its immutable API. Its defaults round to a fixed number of decimal places, so small results silently become 0 (`0.000000000000000001 / 3` and `Sqrt(1e-40)` both return 0). `internal/calc` therefore owns one precision policy: 34 significant digits, half-even rounding, one rounding step per result. No other code rounds.
   - Add, subtract and multiply are exact in shopspring: compute, then round once to 34 significant digits with `RoundBank`.
   - Divide uses `QuoRem` at a computed number of decimal places and rounds half-even from the remainder.
   - Square root and power get their own policy path when they are added.
   - `exact` is `false` when the policy changed the result.
   - Never call `Div`, `DivRound`, `Round`, `Sqrt`, `Pow*` or the `Require*` constructors (they panic), and never change `decimal.DivisionPrecision`. A test enforces this.
   - Request types hold operands as `string`, never `decimal.Decimal`: its JSON decoder silently accepts bare JSON numbers, which breaks rule 2.
4. **Same input, same output.** `internal/calc` is pure: no I/O, no mutable globals, no clock, no logging. Table-driven tests cover every operation and every error.
5. **Every failure is a named error with one status.**
   - 400: `INVALID_REQUEST`, `INVALID_NUMBER`, `WRONG_OPERAND_COUNT`, `UNSUPPORTED_OPERATION`.
   - 404: `NOT_FOUND`. 405: `METHOD_NOT_ALLOWED`. Go's router answers these in plain text by default, so register catch-all routes that return the JSON format.
   - 413: `INPUT_TOO_LARGE`.
   - 422: `DIVISION_BY_ZERO`, `NEGATIVE_SQUARE_ROOT`, `INVALID_EXPONENT`, `OUT_OF_RANGE`.
   - 500: `INTERNAL_ERROR`, which means a bug. Panics are recovered, logged at error level with the request ID, and return a generic message.
   - 503: `SERVICE_UNAVAILABLE`, sent only by nginx. nginx's own errors use the same JSON format: 502, 503 and 504 become `SERVICE_UNAVAILABLE`, and its 413 becomes `INPUT_TOO_LARGE`. A CI smoke test stops the calculator and expects the JSON 503.
   - Domain errors are logged at info level with their code as a field, never at error level.
6. **Inputs have limits, defined in one place, each with a test.**
   - Request body: 4 KiB.
   - An operand is at most 256 characters. Longer is `INPUT_TOO_LARGE`.
   - A number is a plain decimal matching `^-?[0-9]+(\.[0-9]+)?$`: no `+`, exponent, spaces, or leading or trailing dot. Anything else is `INVALID_NUMBER`.
   - At most 34 significant digits, counted from the first non-zero digit to the last. More is `INPUT_TOO_LARGE`.
   - Zero, or a magnitude of at least 10⁻¹⁰⁰ and less than 10¹⁰⁰. An operand or result outside this is `OUT_OF_RANGE`.
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

Ask before implementing these:

- The frontend's visual design and layout (to be drafted as an Artifact).
- How the keypad's `%` key maps onto the `percentage` operation.
- How the display shows long results (up to 34 significant digits, or 100 digits before the decimal point).
