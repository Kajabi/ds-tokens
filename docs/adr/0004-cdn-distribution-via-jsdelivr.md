# 0004. Distribute tokens over the jsDelivr CDN as a first-class channel

- **Status:** Accepted (retrospective)
- **Date:** 2026-07-13
- **Maintainers:** @Kajabi/dss-devs

## Context

`@kajabi-ui/styles` is published to npm, but a large share of consumption is from **server-rendered surfaces** (Rails views, marketing pages) that don't run an npm build for their styling. Those surfaces need the compiled token CSS at runtime via a plain `<link>`, without adding the package to a bundler graph.

## Decision

Treat the **jsDelivr CDN as a first-class distribution channel** alongside npm. Because the package is published to npm, jsDelivr serves its `dist/` automatically, and consumers load the compiled CSS directly:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kajabi-ui/styles@1.4.0/dist/kajabi_products/kajabi_products.css" />
```

This is documented in the package README and is how the primary consumer (kajabi-products) loads tokens at runtime — a **version-pinned** `<link>` in a shared partial, independent of its npm/yarn dependency graph.

## Consequences

**Positive**

- Non-bundler surfaces get tokens with a single `<link>`; no build integration required.
- The CDN URL is explicitly version-pinned, so runtime styling is reproducible and controlled at the point of use.
- npm and CDN share one published artifact — no separate release path.

**Negative / accepted costs**

- **The runtime contract is the CDN URL, not the npm range.** This is the subtle one: pinning the npm dependency range does little for a consumer whose actual tokens come from a hardcoded CDN `<link>`. (This exact confusion led to a pinning PR being opened and then closed as a no-op — see references.) Version discipline has to happen at the `<link>`.
- Pinned CDN links must be bumped by hand when a consumer wants a new token version; a stale link (e.g. an old `@1.0.8` lingering on one page) won't surface as a dependency warning.
- Reliance on jsDelivr availability for runtime styling on those surfaces.

## Alternatives considered

- **npm-only distribution** — rejected: forces every consumer through a bundler, which the server-rendered surfaces don't have for CSS.
- **Self-hosting the compiled CSS in each consumer** — rejected: duplicates the artifact and drifts from the published version.

## References

- `packages/styles/README.md` (documented jsDelivr usage)
- kajabi-products `app/views/shared/_pine_assets.html.erb` (pinned CDN `<link>` for `@kajabi-ui/styles` + `@pine-ds/core`)
- Pine PR #769 (closed) — pinning the npm range was a no-op precisely because the runtime contract is the CDN link
