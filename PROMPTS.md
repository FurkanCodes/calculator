# Selected AI prompts

These are selected prompts from the development log, in their original wording and order. The headings describe the context. The [full log](https://github.com/FurkanCodes/calculator/blob/4fb65f623494e51a0f9a6cf58961059a5e3b3ffb/PROMPTS.md) includes the surrounding discussion and outcome notes.

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
