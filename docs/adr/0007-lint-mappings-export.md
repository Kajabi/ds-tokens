# 0007. Export `lint-mappings` as a cross-repo enforcement contract

- **Status:** Accepted (retrospective)
- **Date:** 2026-07-13
- **Maintainers:** @Kajabi/dss-devs

## Context

Pine enforces "use semantic tokens, not hardcoded values" via custom lint plugins (see Pine ADR-0003). Those plugins need to know the mapping from raw values to core tokens and from core tokens to semantic roles — knowledge that lives here, in the token source. Duplicating that mapping in Pine would guarantee drift the moment a token changes.

## Decision

The build **generates and publishes a machine-readable mapping** so downstream linters consume it from a single source of truth. `scripts/generate-lint-mappings.js` emits `dist/tokens/pine-token-mappings.json` (hex→core, core→semantic), exposed via a dedicated package export:

```json
"./lint-mappings": "./dist/tokens/pine-token-mappings.json"
```

Pine's stylelint plugin imports `@kajabi-ui/styles/lint-mappings`, so lint enforcement stays in lockstep with the tokens it enforces against.

## Consequences

**Positive**

- Lint rules and the token source can't drift — a token change updates the mappings that lint reads.
- The mapping is a real, versioned part of the package contract, not a copy pasted into Pine.
- Other consumers/tools can reuse the same export.

**Negative / accepted costs**

- `lint-mappings` is a public export: its shape is now a contract, and changing it can break Pine's lint build (belongs under the versioning policy like any other output).
- A cross-repo coupling that isn't obvious from either repo alone — hence this ADR.

## Alternatives considered

- **Hardcode the mappings in Pine's lint plugin** — rejected: guarantees drift and puts token knowledge in the wrong repo.
- **Derive mappings at lint time from the raw token JSON** — rejected: pushes transform logic into the consumer; the generated mapping is the clean interface.

## References

- `packages/styles/scripts/generate-lint-mappings.js` (generator)
- `packages/styles/package.json` (`"./lint-mappings"` export)
- Pine ADR-0003 (custom lint plugins that consume this mapping)
