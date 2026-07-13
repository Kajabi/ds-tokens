# 0005. Commit generated output as the versioned contract

- **Status:** Accepted (retrospective)
- **Date:** 2026-07-13
- **Maintainers:** @Kajabi/dss-devs

## Context

Tokens are authored as JSON and transformed to SCSS/CSS by Style Dictionary (see ADR-0001). The transform output could be treated as a throwaway build artifact (gitignored, regenerated on demand). But the generated files *are* the thing consumers and downstream tooling read, and their diffs are the most human-legible signal of what a token change actually did.

## Decision

**Commit the generated output under `packages/styles/_generated/`** and treat it as the versioned contract. The committed files are the source of truth for what ships; every token/source change must regenerate and commit them in the same PR, so the diff shows the real effect on emitted CSS. (The published `dist/` remains gitignored — it's a pure build artifact.)

Enforcement of the source↔output invariant is being added in CI: a drift gate that fails when a fresh build doesn't match the committed output (#45), and semantic-invariant tests over the committed output (#46).

## Consequences

**Positive**

- PR reviewers see the actual emitted-CSS diff, not just a source change whose effect they'd have to imagine.
- The committed output is a stable, inspectable contract; tooling (and the invariant tests) can read it without running a build.
- Regressions in the transform surface as unexpected output diffs.

**Negative / accepted costs**

- Unusual convention — committing build output prompts "why is this checked in?" from newcomers (this ADR is the answer).
- Contributors must remember to regenerate and commit `_generated/`; a source-only change is a bug. The CI drift gate (#45) exists to catch exactly that.
- Larger, noisier diffs on token changes.

## Alternatives considered

- **Gitignore the generated output, regenerate on build** — rejected: hides the real impact of token changes from review and gives the invariant tests nothing committed to check.
- **Snapshot only in tests, don't commit** — rejected: loses the human-legible per-PR diff that is most of the value.

## References

- `packages/styles/_generated/` (committed output), `packages/styles/dist/` (gitignored)
- [CONTRIBUTING.md](../../CONTRIBUTING.md) (regenerate-and-commit workflow)
- PRs #45 (drift gate), #46 (semantic-invariant tests)
