# Architecture Decision Records

This directory records significant decisions made about `ds-tokens` / `@kajabi-ui/styles` — *why* the repo looks the way it does, not just *what* it does.

## Why ADRs?

Several long-lived choices here are not obvious from reading the code: the three-tier token architecture, the Tokens Studio → Style Dictionary pipeline, the CI-bot release flow that works around branch protection, and the theming model. Without a record, the same decisions get re-litigated whenever a new contributor or stakeholder asks "why?". This mirrors the practice already in place in the sibling [Pine](https://github.com/Kajabi/pine) repo.

## Format

We use a lightweight [MADR](https://adr.github.io/madr/) variant. Each ADR is a single short Markdown file capturing:

1. **Context** — what problem or pressure prompted the decision
2. **Decision** — what we chose
3. **Consequences** — what we accept by choosing it (good and bad)
4. **Alternatives considered** — what we rejected and why
5. **References** (optional) — links to PRs, code, tickets, or prior art

See [`0000-template.md`](./0000-template.md).

## Index

| # | Title | Status |
| --- | --- | --- |
| [0001](./0001-three-tier-token-architecture.md) | Three-tier tokens via Tokens Studio + Style Dictionary | Accepted (retrospective) |
| [0002](./0002-release-via-ci-bot-token.md) | Release via CI bot token without disabling branch protection | Accepted (retrospective) |
| [0003](./0003-theming-via-token-sets.md) | Theming via Tokens Studio sets and `[data-theme]` selectors | Accepted (retrospective) |
| [0004](./0004-cdn-distribution-via-jsdelivr.md) | Distribute tokens over the jsDelivr CDN as a first-class channel | Accepted (retrospective) |
| [0005](./0005-committed-generated-output.md) | Commit generated output as the versioned contract | Accepted (retrospective) |
| [0006](./0006-pine-prefix-namespace.md) | Emit a `--pine-*` namespace decoupled from the package name | Accepted (retrospective) |
| [0007](./0007-lint-mappings-export.md) | Export `lint-mappings` as a cross-repo enforcement contract | Accepted (retrospective) |

ADRs 0001–0007 were authored retrospectively to capture decisions already in the codebase. The **Maintainers** field on each names the team that owns the area today, not the original deciders.

## When to write a new ADR

Write one when a change:

- Reshapes architecture (new tier, new transform pipeline, new output target)
- Locks in a long-lived convention (naming, theming strategy, release mechanics)
- Trades off something material (build complexity vs. design-tool fidelity, automation vs. branch protection)
- Will be expensive to reverse later
