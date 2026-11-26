# Stories

Everything this project is meant to deliver, in build order. An item is ticked only when it is built **and** verified (tests pass, and for anything runnable, it was run). The brief's own requirements are marked **(brief)**.

## 1. Design and documentation

- [x] Ground rules and architecture in `CLAUDE.md`
- [x] README describing only what is built: setup, how to run, API examples, design decisions, diagram **(brief)**
- [x] Planned designs in `docs/frontend-design.md` and `docs/production-design.md`
- [x] `PROMPTS.md` with every prompt so far **(brief)**. Keep it updated each session.

## 2. Backend arithmetic (`internal/calc`)

- [x] `add`, `subtract`, `multiply`, `divide` **(brief)**
- [x] Number rules: plain decimal format, at most 256 characters, at most 34 significant digits, range 10⁻¹⁰⁰ to 10¹⁰⁰
- [x] Precision policy: 34 significant digits, half-even, rounded once, with the `exact` flag
- [x] Shared number cases in `testdata/numbers.json`
- [x] Tests: Python `decimal` reference values, fuzz test, and the source scan that bans floats and self-rounding calls
- [ ] `power`: integer exponents from −1000 to 1000, `0^0 = 1`, zero to a negative power gives `DIVISION_BY_ZERO`, a bad exponent gives `INVALID_EXPONENT` **(brief, optional)**
- [ ] `sqrt`: 34 significant digits under the same policy, and a negative operand gives `NEGATIVE_SQUARE_ROOT` **(brief, optional)**
- [ ] `percentage`: a% of b, which is a × b ÷ 100 **(brief, optional)**

## 3. Backend HTTP API (`internal/httpapi`)

- [x] `POST /api/v1/calculate` with strict JSON decoding: one object, no unknown fields, operands as strings **(brief)**
- [x] One JSON error format, one status per code, and JSON 404 and 405 responses **(brief: edge cases)**
- [x] Request IDs, one log line per request, panic recovery
- [x] `GET /healthz`
- [x] Tests for every status and code, plus the boundary test (no decimal import)

## 4. Backend server and container

- [x] `cmd/calculator`: `PORT`, server timeouts, graceful shutdown, `-healthcheck` flag
- [x] `backend/Dockerfile`: multi-stage, distroless, non-root, exec-form `ENTRYPOINT` **(brief)**
- [x] `docker-compose.yml`: health check, stop grace period, read-only and no capabilities **(brief)**
- [ ] Remove the temporary `127.0.0.1:8081` port mapping once the web container exists

## 5. Code quality and merge

- [x] Run the thermo-nuclear code quality review on `feature/backend-core` (verdict: not approved, 2 blockers)
- [x] Fix the review's findings:
  - [x] One error table keyed by code, and the real cause logged on a 500 (blocker)
  - [x] Type-checked allowlist for `calc`'s shopspring calls, floats and imports, replacing the name deny-list (blocker)
  - [x] JSON 405 for every route, including `/healthz`
  - [x] Shape errors in `operands` return `INVALID_REQUEST`; exact, case-sensitive keys
  - [x] `endpoint` writes success responses too, so it logs the status it actually sent
  - [x] Fuzz test only uses operations that have an inverse
  - [x] `number.go`: check the format first, and write the range check as 10⁻¹⁰⁰ ≤ |x| < 10¹⁰⁰
  - [x] Pin the 4 KiB body limit with a 4096-byte request accepted and a 4097-byte one rejected
- [ ] Re-review the fixes before merging
- [ ] Merge `feature/backend-core` into `main`

## 6. Frontend (`frontend/`)

- [ ] Visual design and layout, drafted as an Artifact, including answers to the open questions in `docs/frontend-design.md`
- [ ] Scaffold: Vite, React, TypeScript, Tailwind CSS, Base UI **(brief)**
- [ ] Zod number schema, tested against `testdata/numbers.json` **(brief: input validation)**
- [ ] API client: `fetch`, Zod validation of responses, request cancelling with `AbortController`
- [ ] Calculator state as a pure `useReducer`, with reducer tests
- [ ] Keypad and keyboard input, result display with a "rounded" marker **(brief: intuitive UI)**
- [ ] Error text per error code, and a "service unreachable" state **(brief: error handling)**
- [ ] Responsive layout that works on a phone **(brief)**
- [ ] Component tests with React Testing Library, and a coverage report **(brief)**

## 7. Web container

- [ ] `frontend/nginx.conf`: serves the build, falls back to `index.html`, forwards `/api/*`, returns its own errors in the JSON format
- [ ] `frontend/Dockerfile`, plus the `web` service in `docker-compose.yml`, so one `docker compose up` runs the full stack **(brief)**

## 8. CI

- [ ] GitHub Actions: backend vet and test with coverage, and frontend lint and test with coverage, uploading both coverage reports **(brief: coverage report)**
- [ ] Compose smoke test: one calculation end to end, then the JSON `SERVICE_UNAVAILABLE` with the calculator stopped
- [ ] Container rule checks: hadolint (exec-form `ENTRYPOINT`), and the 5-second shutdown limit stays under Compose's `stop_grace_period`
- [ ] CI badge in the README

## 9. Submission

- [ ] Run every README command from a clean checkout, re-measure coverage, and add a screenshot
- [ ] `PROMPTS.md` complete **(brief)**
- [ ] Make the repository public, or add the reviewers as collaborators **(brief)**
