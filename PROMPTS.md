# Selected AI prompts

These are selected prompts from the development log, in their original wording and order. The headings describe the context.

## Choosing a decimal library

> I would choose shopspring/decimal for general financial apps and web APIs because its immutable API is much easier and safer to use, while cockroachdb/apd is the better pick for high-performance, high-precision calculations where memory allocations and strict rounding rules matter. I think we should stick with shopspring right now because we do not have to worry about performance or precision calculation, right?

## Starting the backend with Docker Compose

> First, set up the docker properly so when I run docker compose up -d it should start the backend.

## Reviewing code quality

> Run the code quality review and report back

## Tracking deliverables

> Create stories.md and write down everything we are suppose to implement and tick them one by one.

## Changing the sign of a displayed result

> yes fix them, negate the shown result

## Making the API explorable

> yes, but also please give us backend API ui as well, use openapi.

## Reconsidering scope

> I feel like we are starting to over-engineer this.

## Preparing the submission

> public, trim read me, do not do a lot of words, stick with simple yet effective readme. keep aws in product design.

## Design note on nginx

We kept the React build and the Go API in separate containers. nginx serves the app on port 8080 and forwards requests under `/api/` to Go on port 8081 inside the Compose network. This gives the browser one origin and lets the frontend call a relative API URL. [Architecture diagram](README.md#architecture)
