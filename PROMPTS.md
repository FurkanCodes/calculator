# AI prompts and decisions

I used Claude Code for design discussion, implementation, and review. The entries below are **paraphrases grouped by topic**. Routine approvals, merge instructions, and repeated follow-ups are condensed. The [original conversation prompts and outcome notes](https://github.com/FurkanCodes/calculator/blob/4fb65f623494e51a0f9a6cf58961059a5e3b3ffb/PROMPTS.md) preserve the wording recorded during development.

| Topic | What I asked | Decision or outcome |
| --- | --- | --- |
| Scope | Which parts of the microservice design fit the assignment? Would a gateway and API keys be worthwhile? | Ship one stateless Go service and a React client. Describe the AWS option separately. |
| Arithmetic | How should a general calculator handle decimal values? Compare shopspring/decimal with alternatives and consider whether monetary minor units fit. | Pass operands as decimal strings. Round once to 34 significant digits using half-even rounding and report whether the result was exact. |
| API | Review a versioned calculate endpoint, a health check, graceful shutdown, and a consistent error response. | Go owns validation and arithmetic. Each API error carries a stable code and message. |
| Deployment | Why keep nginx? How do the frontend and backend ports relate? Can proxy failures use the API error format? | nginx serves React and forwards API requests. Only its port is published. The calculator listens on the internal network. |
| Interaction | Compare UI directions. Define how percentage, sign changes, long results, and unknown error codes should behave. | Choose the Ledger design. For example, in `50 + 10 %`, the percentage replaces the second operand with `5`, so pressing equals returns `55`. |
| Verification | Review the calculation and API changes, fix the findings, and check delivery against the brief. | Add shared validation fixtures, independent arithmetic references, OpenAPI examples checked against the handler, and a Compose smoke test. |
| Documentation | Keep setup and API examples easy to find. Explain the main design decisions and report measured coverage. | Put the quick start in the README and move detailed architecture, frontend behavior, and the AWS proposal into dedicated documents. |

Claude Code used EGM brainstorming during design, the thermo-nuclear code quality review skill during implementation, and readme-optimization during editing. Larger implementation tasks ran on separate branches. Codex helped review the submission and edit this summary.
