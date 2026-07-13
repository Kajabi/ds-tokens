# Contributing to ds-tokens

`ds-tokens` produces `@kajabi-ui/styles` — the design tokens that Pine and every
consuming Kajabi app build on. Because the published output is a **contract many
teams depend on**, this guide covers not just *how* to change a token but how to
do it without breaking downstream consumers. For the versioning and
breaking-change policy, see [VERSIONING.md](./VERSIONING.md).

## Prerequisites

- Node.js `22` (see [`.nvmrc`](./.nvmrc)) — `nvm use` will pick it up
- npm (the repo uses npm workspaces; do not use yarn despite occasional mentions)

## Setup

```bash
git clone https://github.com/Kajabi/ds-tokens.git
cd ds-tokens
npm install
npx nx build @kajabi-ui/styles   # generates token output
```

## How the repo is laid out

Nx monorepo with a single published package, `packages/styles` (`@kajabi-ui/styles`).

```
packages/styles/
  src/
    tokens/                 # SOURCE OF TRUTH (Tokens Studio JSON)
      brand/core.json       #   primitive tier — raw palette, spacing, shadows, type
      semantic/             #   semantic tier — light.json / dark.json (roles)
      components/           #   component tier — alert, chip, input, select (+ -dark)
      kajabi_products/      #   brand theme overrides (light/dark)
      $themes.json          #   Tokens Studio theme/set definitions
      $metadata.json        #   Tokens Studio metadata
    lib/transform/          # Style Dictionary build (JSON -> SCSS/CSS)
  _generated/               # COMMITTED build output — the contract consumers read
  dist/                     # build artifact (gitignored, published to npm)
```

Tokens flow **primitive → semantic → component**. Higher tiers reference lower
ones (`{color.grey.900}`), never the reverse. Output custom properties are
prefixed `--pine-*`.

## Making a change

> **Authoring in Figma (Token Studio).** These source JSON files are the
> [Tokens Studio](https://tokens.studio/) export format — Figma is the design
> source of truth, and `$themes.json` / `$metadata.json` are Token Studio's own
> files. Token changes often originate in Figma and are synced here; editing the
> JSON directly (below) is the code side of the same files. For a change that
> should round-trip to design, coordinate with @Kajabi/dss-devs so Figma and the
> repo don't diverge. See [Using Token Studio](./packages/styles/README.md#using-token-studio)
> and [ADR-0001](./docs/adr/0001-three-tier-token-architecture.md).

1. **Edit the source JSON**, not the generated output. Pick the right tier:
   - new raw value (a color, a spacing step) → `brand/core.json`
   - a role (text, background, border, etc.) → `semantic/light.json` + `semantic/dark.json`
   - a component-specific token → `components/*.json` (+ matching `-dark.json`)

2. **Regenerate and commit the output.** `_generated/` is committed and is what
   consumers read — it must always be in sync with the source:
   ```bash
   npx nx build @kajabi-ui/styles
   git add packages/styles/src packages/styles/_generated
   ```
   A PR that changes source but not `_generated/` (or vice versa) is a bug.
   Reviewers check the regenerated diff.

3. **Lint:**
   ```bash
   npx nx affected --target=lint
   ```

4. **Check the impact on consumers.** Before opening the PR, classify your change
   against [VERSIONING.md](./VERSIONING.md): is it additive (minor), a value tweak
   (patch), or **breaking** (removing/renaming a token, changing what a semantic
   token means)? Breaking changes need a migration note — see below.

## Branches & commits

**Branch names** are enforced by a pre-push hook. Use `type/short-description`
where `type` is one of:

```
chore  ci  docs  feat  fix  hotfix  perf  refactor  revert  style  test
```

> ⚠️ `feature/…` is **not** valid (the hook rejects it) — use `feat/…`.

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org/)
and are enforced by commitlint. The type is not cosmetic — it **drives the next
release version** (see [VERSIONING.md](./VERSIONING.md)):

| Commit | Result |
| --- | --- |
| `feat: …` | minor bump |
| `fix: …` | patch bump |
| `feat!:` / `BREAKING CHANGE:` footer | major bump |
| `docs:` / `chore:` / `style:` / `refactor:` | no release on its own |

Keep messages to a single line; scope when it helps (`feat(chip): …`).

## Pull requests

- Open against `main`. `@Kajabi/dss-devs` (via `CODEOWNERS`) reviews token changes.
- CI runs build + lint across the Node matrix. Regenerating `_generated/` is the
  contributor's responsibility (reviewers check the regenerated diff).
- For any **breaking change**, the PR description must include a **Migration**
  section: what was removed/renamed, the replacement, and a before/after snippet.
  This text becomes the basis for the changelog migration note.

## Git hooks (lefthook)

Run automatically; don't skip them:

- **pre-commit** — stylelint + eslint on staged files
- **commit-msg** — commitlint (conventional commits)
- **pre-push** — branch-name validation

## Releasing

Releases are cut by the maintainers via the `release` workflow (manual dispatch),
not automatically on merge. Versioning is Nx Release driven by the conventional
commits since the last release; publishing goes to npm with provenance, pushed by
the `kajabi-github-actions` bot using `KAJABI_CI_GH_TOKEN`. The `CHANGELOG.md` is
generated from commit history. See [VERSIONING.md](./VERSIONING.md) for the full
policy.
