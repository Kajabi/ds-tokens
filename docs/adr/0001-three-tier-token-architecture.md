# 0001. Three-tier tokens via Tokens Studio + Style Dictionary

- **Status:** Accepted (retrospective)
- **Date:** 2026-06-26
- **Maintainers:** @Kajabi/dss-devs

## Context

`@kajabi-ui/styles` is consumed by Pine components and by non-Pine surfaces (Rails views, marketing pages, internal tooling) that all need consistent color, spacing, type, shadow, motion, and z-index values. The design source of truth lives in Figma via Tokens Studio. We needed a structure that (1) lets designers author in Figma and export deterministically, (2) separates raw values from their semantic intent so a re-skin doesn't touch every reference, and (3) emits CSS custom properties consumers can use directly.

## Decision

Author tokens as **Tokens Studio JSON** organized into three tiers, and transform them to CSS/SCSS/JSON with **Style Dictionary** (via `@tokens-studio/sd-transforms`):

- **Primitive** (`src/tokens/brand/core.json`) — raw palette, spacing, shadow, type, motion, z-index.
- **Semantic** (`src/tokens/semantic/`) — roles (`color.text.*`, `color.background.*`, …) that reference primitives.
- **Component** (`src/tokens/components/`) — per-component tokens (alert, chip, input, select) that reference semantics.

Higher tiers reference lower ones (`{color.grey.900}`); never the reverse. Output is prefixed `--pine-*`. The generated output is committed under `_generated/` and is the contract consumers read; `dist/` is the published artifact.

## Consequences

**Positive**

- A re-skin changes primitives (or semantic mappings) without editing every consumer.
- Figma ↔ code stays in sync through the Tokens Studio export format.
- References resolve to real `var(--pine-*)` chains, so consumers get the cascade for free.

**Negative / accepted costs**

- The transform (`src/lib/transform/index.js`) carries real complexity — composite tokens (typography/border/shadow), theme permutation, and format registration all live there. It is the most fragile file in the repo.
- A build step is required to go from source to output, and the generated output is committed, so contributors must regenerate and commit `_generated/` with every token change (see [CONTRIBUTING.md](../../CONTRIBUTING.md)).
- Style Dictionary + Tokens Studio is a learning curve for new contributors.

## Alternatives considered

- **Hand-authored SCSS variables** — rejected: no Figma round-trip, error-prone, and no enforced tier separation.
- **A single flat token list** — rejected: collapses primitive and semantic layers, so every value change ripples to consumers and re-skins are impossible.
- **Generating straight to Pine on build (no published package)** — rejected: non-Pine consumers and the lint mappings still need a canonical, independently versioned source. See Pine ADR-0001 (externalized token package).

## References

- `packages/styles/src/tokens/` (source), `packages/styles/_generated/` (committed output)
- `packages/styles/src/lib/transform/index.js` (Style Dictionary build)
- Sibling repo: `Kajabi/pine` (consumer; ADR-0001 there documents the externalization from Pine's side)
