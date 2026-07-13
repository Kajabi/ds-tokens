# 0006. Emit a `--pine-*` namespace decoupled from the package name

- **Status:** Accepted (retrospective)
- **Date:** 2026-07-13
- **Maintainers:** @Kajabi/dss-devs

## Context

The package is named `@kajabi-ui/styles`, but every custom property it emits is prefixed `--pine-*` (e.g. `--pine-color-background-overlay`). This mismatch reliably confuses newcomers: "why does a `kajabi-ui` package emit `pine` variables?"

## Decision

Emit all tokens under the **`pine` namespace** — the design system's name — independent of the npm package name. The prefix is set once as the Style Dictionary transform default (`options.prefix || 'pine'`) and applied uniformly across every output file.

The package name (`@kajabi-ui/styles`, the broader Kajabi UI umbrella) and the CSS-variable namespace (`--pine-*`, the design system consumers actually reference) are deliberately **decoupled**.

## Consequences

**Positive**

- Consumers reference a stable, design-system-branded namespace (`var(--pine-*)`) that won't churn if the package is renamed, re-homed, or re-scoped.
- One short, collision-resistant prefix across all tiers and themes.
- Aligns the variable namespace with Pine, the design system these tokens serve, rather than with packaging/distribution details.

**Negative / accepted costs**

- The package-name vs. prefix mismatch is a recurring "why?" (this ADR is the standing answer).
- Renaming the prefix later would be a breaking change for every consumer, so `pine` is effectively permanent.

## Alternatives considered

- **Match the prefix to the package (`--kajabi-ui-*`)** — rejected: longer, ties the consumer-facing namespace to a packaging name that can change, and doesn't reflect the design system identity.
- **No prefix / generic names (`--color-*`)** — rejected: high collision risk in consuming apps that also define their own custom properties.

## References

- `packages/styles/src/lib/transform/index.js` (`prefix` default of `pine`)
- `packages/styles/_generated/` (uniform `--pine-*` output)
