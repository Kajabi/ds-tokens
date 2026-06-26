# 0003. Theming via Tokens Studio sets and `[data-theme]` selectors

- **Status:** Accepted (retrospective)
- **Date:** 2026-06-26
- **Maintainers:** @Kajabi/dss-devs

## Context

The token set must support light and dark modes and more than one brand (a Pine baseline and a `kajabi_products` brand) from a single source of truth, without shipping a separate package per theme or forcing consumers into runtime JavaScript theming.

## Decision

Model themes as **Tokens Studio theme sets** and permutate them at build time (`permutateThemes` from `@tokens-studio/sd-transforms`):

- **Light/dark** are authored as parallel semantic sets (`semantic/light.json`, `semantic/dark.json`) and merged into one output file, with dark values emitted under a `[data-theme="dark"]` selector.
- **Brands** are emitted as separate entry files (`pine.scss`, `kajabi_products.scss`), each containing its light + dark contexts.
- A **site-brand override** (`[data-theme="site"]`) remaps accent tokens onto consumer-provided variables (e.g. `--kj-brand-primary`) so a Kajabi site can inject its own brand color.

Consumers switch theme by setting `data-theme` on a root element; no JS token engine is required.

## Consequences

**Positive**

- One source of truth produces every theme; consumers opt in via a single `data-theme` attribute.
- Dark mode is "free" for any consumer using semantic tokens — the variable resolves differently under the dark selector. (This is what Pine ADR-0005 relies on for its per-component dark-mode rollout.)
- Brand and site overrides compose through the cascade rather than through forked builds.

**Negative / accepted costs**

- Theme permutation adds the most intricate logic in the transform — filtering which sets belong to which output is where build bugs are most likely.
- Each component that needs a distinct dark treatment requires a matching `*-dark.json` token set, so component-token additions come in light/dark pairs.
- The set of supported themes is fixed at build time; a new brand means new source sets and a new output file, not a runtime config.

## Alternatives considered

- **A separate published package per theme** — rejected: duplicates the primitive layer and multiplies release overhead.
- **Runtime JS theming (resolve tokens in the browser)** — rejected: tokens are CSS-first; the cascade + `data-theme` gives theming with zero runtime cost.
- **Hardcoding dark values into each component downstream** — rejected: pushes theming responsibility onto every consumer and defeats the semantic layer (ADR-0001).

## References

- `packages/styles/src/tokens/$themes.json` (Tokens Studio set/theme definitions)
- `packages/styles/src/tokens/semantic/{light,dark}.json`, `components/*-dark.json`
- `packages/styles/_generated/{pine/pine.scss, kajabi_products/kajabi_products.scss}`
- Sibling repo `Kajabi/pine` ADR-0005 (dark mode via semantic-token migration)
