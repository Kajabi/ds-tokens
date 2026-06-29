# 0002. Release via CI bot token without disabling branch protection

- **Status:** Accepted (retrospective)
- **Date:** 2026-06-26
- **Maintainers:** @Kajabi/dss-devs

## Context

Releasing `@kajabi-ui/styles` with Nx Release means pushing a version-bump commit and tag to `main`, then publishing to npm. `main` is protected, so the default `GITHUB_TOKEN` in CI cannot push the release commit — the release workflow was blocked. We needed automated, reproducible releases **without** weakening branch protection on `main`.

## Decision

The `release` workflow authenticates as the **`kajabi-github-actions` bot** using the `KAJABI_CI_GH_TOKEN` secret, which is permitted to bypass branch protection. The workflow re-points the git origin to that token's identity, lets `npx nx release` create and push the version commit/tag, and publishes to npm with provenance attestation. The release is triggered manually (`workflow_dispatch` / `workflow_call`), not automatically on merge.

## Consequences

**Positive**

- Branch protection on `main` stays on for everyone, including CI.
- Releases are reproducible and auditable — they run in CI, not from a maintainer's laptop.
- npm provenance gives consumers a verifiable build origin.

**Negative / accepted costs**

- `KAJABI_CI_GH_TOKEN` is a privileged credential that must be maintained and rotated; its compromise would bypass branch protection.
- Release commits appear under the bot identity rather than a human author.
- Releases are a deliberate manual step — nothing ships just by merging to `main` (acceptable, and arguably desirable, for a contract package).

## Alternatives considered

- **Disable branch protection on `main`** — rejected: removes the guardrail for all changes to protect a once-per-release push.
- **Use the default `GITHUB_TOKEN`** — rejected: it cannot push past branch protection, which is the whole problem.
- **Release from a maintainer's machine** — rejected: not reproducible, not auditable, and ties releases to one person's environment.

## References

- `.github/workflows/release.yml` (origin re-point via `KAJABI_CI_GH_TOKEN`, `nx release`, npm publish with provenance)
- [VERSIONING.md](../../VERSIONING.md) (how the version bump is computed from Conventional Commits)
