import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

// The files in _generated/ are the contract this repo ships to Pine and other
// consumers. These tests assert *semantic* invariants over that generated output
// (references resolve, no empty values, critical tokens exist) — a layer above the
// CI golden-output gate, which only checks the output hasn't drifted from source.

const stylesRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const generatedRoot = join(stylesRoot, '_generated');

const files = globSync('**/*.scss', { cwd: generatedRoot, absolute: true }).sort();
const sources = files.map((file) => ({
  rel: relative(stylesRoot, file),
  content: readFileSync(file, 'utf8'),
}));

// Set of every custom property defined across the generated output.
const defined = new Set();
for (const { content } of sources) {
  for (const m of content.matchAll(/(--pine-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
}

// Every `var(--pine-*)` reference, with the first file it appears in (for messages).
const referenced = new Map();
for (const { rel, content } of sources) {
  for (const m of content.matchAll(/var\((--pine-[a-z0-9-]+)/g)) {
    if (!referenced.has(m[1])) referenced.set(m[1], rel);
  }
}

// Known pre-existing dangling references, tracked for a separate fix. The guard's
// job is to prevent *new* ones; documenting these keeps the suite green without
// hiding the debt. Remove an entry here once the underlying token is fixed.
//
// --pine-monospace: emitted by the `typography.body.mono` / `body-sm-mono` composite
// tokens (source fontFamily "monospace" rendered as a token ref instead of the CSS
// keyword). It is referenced but never defined, so monospace typography tokens
// currently resolve to nothing. Tracked for a dedicated token-output fix.
const KNOWN_DANGLING = new Set(['--pine-monospace']);

// Anchor tokens that must always exist — a smoke test that generation produced
// real output and the core/semantic layers are present.
const CRITICAL_TOKENS = [
  '--pine-color-white',
  '--pine-color-black',
  '--pine-color-background-overlay',
  '--pine-z-index-overlay',
];

describe('generated token output', () => {
  it('produces the expected generated SCSS files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it('contains no unresolved Style Dictionary references ({token.ref})', () => {
    const offenders = sources
      .map(({ rel, content }) => {
        const hits = [...content.matchAll(/\{[a-zA-Z0-9._$-]+\}/g)].map((m) => m[0]);
        return hits.length ? `${rel}: ${[...new Set(hits)].join(', ')}` : null;
      })
      .filter(Boolean);
    expect(offenders, `Unresolved token references:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('contains no empty custom-property values', () => {
    const offenders = sources
      .flatMap(({ rel, content }) =>
        [...content.matchAll(/(--pine-[a-z0-9-]+):\s*;/g)].map((m) => `${rel}: ${m[1]}`)
      );
    expect(offenders, `Empty token values:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('resolves every var(--pine-*) reference to a defined token', () => {
    const dangling = [...referenced.keys()]
      .filter((ref) => !defined.has(ref) && !KNOWN_DANGLING.has(ref))
      .map((ref) => `${ref} (first seen in ${referenced.get(ref)})`);
    expect(
      dangling,
      `Dangling references — used via var() but never defined:\n${dangling.join('\n')}`
    ).toEqual([]);
  });

  it('keeps the known-dangling allowlist honest (drop entries once fixed)', () => {
    const nowResolved = [...KNOWN_DANGLING].filter((ref) => defined.has(ref));
    expect(
      nowResolved,
      `These are now defined — remove them from KNOWN_DANGLING:\n${nowResolved.join('\n')}`
    ).toEqual([]);
  });

  it('defines all critical anchor tokens', () => {
    const missing = CRITICAL_TOKENS.filter((t) => !defined.has(t));
    expect(missing, `Missing critical tokens:\n${missing.join('\n')}`).toEqual([]);
  });
});
