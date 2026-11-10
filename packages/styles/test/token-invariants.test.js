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
const KNOWN_DANGLING = new Set();

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

// DSS-505: semantic text tokens must stay distinguishable from disabled text, and
// legible as body text, in both themes. Both properties collapsed silently once
// before (an "active, de-emphasized" token and a "*-disabled" token aliased the
// same core grey — a 1.00:1 contrast between them — and three active tokens fell
// below WCAG AA 4.5:1 on their own background in light mode) because nothing
// checked the *resolved* color, only that references were well-formed. This guard
// resolves every --pine-color-text-* custom property to a real hex value and
// checks both properties directly, so the ramp can't drift back without failing CI.
describe('text token contrast and active/disabled distinctness (DSS-505)', () => {
  function relativeLuminance(hex) {
    const n = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
    const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrastRatio(hexA, hexB) {
    const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  }

  const coreSource = sources.find(({ rel }) => rel.endsWith('base/_core.scss'));
  const semanticSource = sources.find(({ rel }) => rel.endsWith('base/_semantic.scss'));

  // Core palette: --pine-color-grey-500: #9b9a98; (also picks up white/black).
  const coreHex = new Map();
  for (const m of coreSource.content.matchAll(/(--pine-color-[a-z0-9-]+):\s*(#[0-9a-f]{3,8});/gi)) {
    coreHex.set(m[1], m[2].toLowerCase());
  }

  // Split the single generated file into its light (:root) and dark
  // ([data-theme="dark"]) blocks, same structure the earlier tests rely on.
  const darkMarker = '[data-theme="dark"]';
  const darkIndex = semanticSource.content.indexOf(darkMarker);
  const themeBlocks = {
    light: semanticSource.content.slice(0, darkIndex),
    dark: semanticSource.content.slice(darkIndex),
  };

  // Resolve every `--pine-color-text-*: var(--pine-color-X);` (or a direct hex) to
  // a hex value, per theme. Tokens whose background context differs from the
  // default page/container background are out of scope for this guard:
  // text-inverse-* is meant for an inverse-colored surface, not the page
  // background used below, so it is not a meaningful comparison point.
  function resolveTextTokens(block) {
    const resolved = new Map();
    for (const m of block.matchAll(/(--pine-color-text(?:-[a-z0-9-]+)?):\s*(?:var\((--pine-color-[a-z0-9-]+)\)|(#[0-9a-f]{3,8}));/gi)) {
      const [, name, ref, hex] = m;
      if (name.includes('-inverse')) continue;
      resolved.set(name, hex ? hex.toLowerCase() : coreHex.get(ref));
    }
    return resolved;
  }

  const background = { light: '#ffffff', dark: '#000000' };

  for (const theme of ['light', 'dark']) {
    const tokens = resolveTextTokens(themeBlocks[theme]);

    it(`[${theme}] no active text token resolves to the same color as any disabled text token`, () => {
      const activeEntries = [...tokens].filter(([name]) => !name.endsWith('-disabled'));
      const disabledEntries = [...tokens].filter(([name]) => name.endsWith('-disabled'));

      const collisions = [];
      for (const [activeName, activeHex] of activeEntries) {
        for (const [disabledName, disabledHex] of disabledEntries) {
          if (activeHex === disabledHex) collisions.push(`${activeName} (${activeHex}) == ${disabledName}`);
        }
      }
      expect(
        collisions,
        `Active and disabled text tokens must not alias the same color — a de-emphasized-but-active token should never render pixel-identical to a disabled one:\n${collisions.join('\n')}`
      ).toEqual([]);
    });

    it(`[${theme}] body-text tokens meet WCAG AA (4.5:1) against the page background`, () => {
      const bodyTextTokens = [
        '--pine-color-text',
        '--pine-color-text-muted',
        '--pine-color-text-tertiary',
        '--pine-color-text-placeholder',
        '--pine-color-text-strong',
      ];
      const failures = bodyTextTokens
        .map((name) => {
          const hex = tokens.get(name);
          const ratio = contrastRatio(hex, background[theme]);
          return ratio < 4.5 ? `${name}: ${hex} on ${background[theme]} = ${ratio.toFixed(2)}:1` : null;
        })
        .filter(Boolean);
      expect(failures, `Below the 4.5:1 AA floor for normal body text:\n${failures.join('\n')}`).toEqual([]);
    });

    // text-subtle is documented (see its description in src/tokens/semantic/*.json)
    // as restricted to large text (18pt/24px regular, 14pt/18.66px bold) and UI
    // components, where WCAG's floor is 3:1, not 4.5:1. If that restriction is
    // ever lifted, this should be raised to the 4.5:1 check above instead.
    it(`[${theme}] text-subtle meets the WCAG AA UI/large-text floor (3:1) against the page background`, () => {
      const hex = tokens.get('--pine-color-text-subtle');
      const ratio = contrastRatio(hex, background[theme]);
      expect(ratio, `--pine-color-text-subtle: ${hex} on ${background[theme]} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  }
});
