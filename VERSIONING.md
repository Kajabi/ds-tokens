# Versioning & breaking-change policy

`@kajabi-ui/styles` is consumed by Pine and many downstream apps that upgrade on
their own schedule. The published token set is a **public contract**. This
document defines what counts as a breaking change, how we deprecate, and how
releases are cut, so consumers can upgrade with confidence.

We follow [Semantic Versioning](https://semver.org/). The unit of the contract is
the **set of emitted `--pine-*` custom properties** in `_generated/` (and the
published `dist/`), not the internal source JSON.

## What each version level means for tokens

### MAJOR — breaking, requires a migration note
A consumer pinned to the previous version could break. Includes:

- **Removing** a token that was previously emitted.
- **Renaming** a token (this is a remove + add — see deprecation below).
- **Changing the meaning** of a semantic or component token such that consumers
  must react — e.g. repointing `--pine-color-text-danger` to a non-danger color,
  or changing a token's type (color → length).
- **Changing the output structure/format** — selector strategy, file layout under
  `_generated/`/`dist/`, the `--pine-` prefix, or the package's export paths.

### MINOR — additive, backward compatible
- **Adding** a new token, theme, or mode.
- Adding a new output file or export that doesn't alter existing ones.

### PATCH — value tweaks & internals
- Adjusting a **primitive value** where the token's *meaning* is unchanged
  (e.g. nudging a grey hex, fixing a shadow offset).
- Transform/build fixes that correct output without changing the token set
  (e.g. fixing a malformed reference).
- Docs and tooling.

### The grey area: value changes
A color/spacing value change is **visually** impactful but not **API**-breaking —
the token still exists and still means the same thing. We treat pure value changes
as **patch/minor**, never major. But: if a value change is visually significant
(a noticeable hue/contrast shift, a spacing scale change), **call it out
explicitly in the PR and changelog** so consumers can decide whether to QA. Don't
let a "patch" silently restyle every downstream app without a heads-up.

When in doubt, size up, not down. Shipping a breaking change as a minor is far
more expensive than an over-cautious major.

## Deprecation — prefer it over removal

Don't hard-remove or rename tokens in place. Instead:

1. Keep the old token emitting. If renaming, point the old name at the new one so
   it keeps resolving.
2. Mark it deprecated in the PR description and `CHANGELOG.md`, naming the
   replacement.
3. Remove it only in a subsequent **major** release, with a migration note.

This gives consumers a window to migrate on a version where their build still
works, instead of breaking on upgrade.

## Migration notes

Every breaking change ships with a migration note (in the PR, carried into the
changelog) containing:

- what was removed/renamed/repointed,
- the replacement token,
- a before/after snippet.

Example:

```
### Breaking
- Renamed `--pine-color-bg-overlay` → `--pine-color-background-overlay`.
  Migrate: replace `var(--pine-color-bg-overlay)` with
  `var(--pine-color-background-overlay)`. The old name is removed in this release.
```

## How releases are cut

- **Trigger:** maintainers run the `release` workflow manually (`workflow_dispatch`)
  — releases are intentional, not automatic on merge to `main`.
- **Version:** Nx Release computes the bump from the Conventional Commits since the
  last release (`feat` → minor, `fix` → patch, `feat!`/`BREAKING CHANGE:` → major).
  Writing the right commit type is therefore part of getting the version right.
- **Publish:** to npm with provenance. The version commit and tag are pushed by the
  `kajabi-github-actions` bot via `KAJABI_CI_GH_TOKEN`, which is why branch
  protection can stay on.
- **Changelog:** `CHANGELOG.md` is generated from commit history; migration notes
  for breaking changes should be reflected there.

## Consumer guidance

- Pin a real range (`^1.x`), not `*`. A wildcard pulls every change — including a
  visually significant value tweak — with no gate.
- Read the changelog before a minor/major bump; watch for migration and
  "visually significant" notes.
