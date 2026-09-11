#!/usr/bin/env node

/**
 * Generate Pine Token Mappings for Linting
 *
 * This script reads core.json and semantic.json to generate pine-token-mappings.json
 * which is used by ESLint and Stylelint plugins to:
 * 1. Convert hardcoded hex values to Pine core tokens
 * 2. Suggest semantic tokens based on context (text, background, border)
 *
 * Output: dist/tokens/pine-token-mappings.json
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const tokensDir = path.join(rootDir, 'dist', 'tokens');
const coreTokensPath = path.join(tokensDir, 'core.json');
const semanticTokensPath = path.join(tokensDir, 'semantic.json');
const outputPath = path.join(tokensDir, 'pine-token-mappings.json');

console.log('Generating Pine token mappings for linting...');

// Read token files
if (!fs.existsSync(coreTokensPath)) {
  console.error('❌ core.json not found at', coreTokensPath);
  process.exit(1);
}

if (!fs.existsSync(semanticTokensPath)) {
  console.error('❌ semantic.json not found at', semanticTokensPath);
  process.exit(1);
}

const coreTokens = JSON.parse(fs.readFileSync(coreTokensPath, 'utf-8'));
const semanticTokens = JSON.parse(fs.readFileSync(semanticTokensPath, 'utf-8'));

/**
 * Build hexToCore mappings from core.json
 * Groups by color family (neutrals, blues, greens, etc.)
 */
function buildHexToCore(coreTokens) {
  const colorGroups = {
    neutrals: {},
    blues: {},
    greens: {},
    reds: {},
    yellows: {},
    purples: {},
    mercury: {},
    forest: {},
    lime: {},
    magenta: {},
    pink: {},
    salmon: {},
    sky: {},
    teal: {}
  };

  const colors = coreTokens.color;
  if (!colors) return colorGroups;

  // Handle white and black specially
  if (colors.white?.value) {
    colorGroups.neutrals[colors.white.value.toLowerCase()] = 'white';
  }
  if (colors.black?.value) {
    colorGroups.neutrals[colors.black.value.toLowerCase()] = 'black';
  }

  // Map color family names to group keys
  const familyToGroup = {
    grey: 'neutrals',
    blue: 'blues',
    green: 'greens',
    red: 'reds',
    yellow: 'yellows',
    purple: 'purples',
    mercury: 'mercury',
    forest: 'forest',
    lime: 'lime',
    magenta: 'magenta',
    pink: 'pink',
    salmon: 'salmon',
    sky: 'sky',
    teal: 'teal'
  };

  // Process each color family
  for (const [family, shades] of Object.entries(colors)) {
    const groupKey = familyToGroup[family];
    if (!groupKey || typeof shades !== 'object') continue;

    for (const [shade, tokenData] of Object.entries(shades)) {
      if (tokenData?.value && tokenData.type === 'color') {
        const hex = tokenData.value.toLowerCase();
        const tokenName = `${family}-${shade}`;
        colorGroups[groupKey][hex] = tokenName;
      }
    }
  }

  return colorGroups;
}

/**
 * Look up a dotted token path (e.g. "color.grey.900") in a token tree.
 */
function lookupTokenPath(root, path) {
  return path
    .split('.')
    .reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), root);
}

/**
 * Resolve a token reference like "{color.grey.900}" to the core token "grey-900".
 *
 * A semantic token may reference another semantic token rather than the palette
 * directly (e.g. color.accent.@ → {color.primary.@} → {color.grey.900}). These
 * mappings only describe core tokens, so follow the chain to the palette rather
 * than emitting the intermediate name, which is not a real core token.
 *
 * Returns `{ token, isAlias }`, where `isAlias` marks a role that reaches the
 * palette only through another role.
 */
function resolveColorReference(ref, seen = new Set()) {
  if (!ref || typeof ref !== 'string') return null;

  const match = ref.match(/\{(color\.[^}]+)\}/);
  if (!match) return null;

  const path = match[1];
  if (seen.has(path)) return null;
  seen.add(path);

  const parts = path.split('.').slice(1);

  // A hit in the palette terminates the chain.
  const coreNode = lookupTokenPath(coreTokens, path);
  if (coreNode?.type === 'color' && typeof coreNode.value === 'string' && !coreNode.value.includes('{')) {
    let token = null;
    if (parts.length === 1) {
      // Simple reference like {color.white}
      token = parts[0];
    } else if (parts.length === 2) {
      // Shade reference like {color.grey.900}
      token = `${parts[0]}-${parts[1]}`;
    }
    return token ? { token, isAlias: false } : null;
  }

  // Otherwise keep resolving through the semantic layer.
  const semanticNode = lookupTokenPath(semanticTokens, path);
  if (typeof semanticNode?.value === 'string') {
    const resolved = resolveColorReference(semanticNode.value, seen);
    return resolved ? { ...resolved, isAlias: true } : null;
  }

  return null;
}

/**
 * Build context-based mappings from semantic.json
 * Returns: { text: { coreToken: semanticToken }, background: {...}, border: {...} }
 */
function buildContextMappings(semanticTokens) {
  const mappings = {
    text: {},
    background: {},
    border: {}
  };

  const colors = semanticTokens.color;
  if (!colors) return mappings;

  /**
   * Generic processor for nested token structures
   * @param {object} obj - Token object to process
   * @param {string} context - 'text', 'background', or 'border'
   * @param {string} prefix - Current path prefix
   */
  function processTokens(obj, context, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      // Build the token path, handling "@" as the base token
      let tokenPath;
      if (key === '@') {
        tokenPath = prefix || context;
      } else if (prefix) {
        tokenPath = `${prefix}-${key}`;
      } else {
        tokenPath = key;
      }

      if (value?.value && value.type === 'color') {
        const resolved = resolveColorReference(value.value);
        // Roles that only alias another role (color.text.accent.* → color.primary.*)
        // are not the canonical name for their color, so suggesting them over the
        // role that owns the palette value outright would make the hint worse.
        const coreToken = resolved && !resolved.isAlias ? resolved.token : null;
        if (coreToken) {
          // Build the semantic token name
          let semanticName = tokenPath;

          // Ensure context prefix
          if (!semanticName.startsWith(context)) {
            semanticName = `${context}-${semanticName}`;
          }

          // Clean up double prefixes and trailing dashes
          semanticName = semanticName
            .replace(new RegExp(`^${context}-${context}`), context)
            .replace(/-+/g, '-')
            .replace(/-$/, '');

          // Special case: just the context name (e.g., "text", "border")
          if (semanticName === context) {
            semanticName = context;
          }

          // For text context base, use "text" not "text-text"
          if (context === 'text' && tokenPath === 'text') {
            semanticName = 'text';
          }

          // Only add if not already mapped (first wins for primary semantic)
          if (!mappings[context][coreToken]) {
            mappings[context][coreToken] = semanticName;
          }
        }
      } else if (typeof value === 'object' && value !== null && !value.value) {
        // Nested object, recurse with updated prefix
        processTokens(value, context, tokenPath);
      }
    }
  }

  // Process each context
  if (colors.text) {
    processTokens(colors.text, 'text', 'text');
  }
  if (colors.background) {
    processTokens(colors.background, 'background', 'background');
  }
  if (colors.border) {
    processTokens(colors.border, 'border', 'border');
  }

  return mappings;
}

/**
 * Build ambiguous token list - tokens that map to different semantics based on context
 */
function buildAmbiguous(mappings) {
  const coreToSemantics = {};

  // Collect all semantic tokens for each core token
  for (const context of ['text', 'background', 'border']) {
    for (const [core, semantic] of Object.entries(mappings[context])) {
      if (!coreToSemantics[core]) {
        coreToSemantics[core] = new Set();
      }
      coreToSemantics[core].add(semantic);
    }
  }

  // Filter to only ambiguous tokens (more than one semantic meaning)
  const ambiguous = {};
  for (const [core, semantics] of Object.entries(coreToSemantics)) {
    if (semantics.size > 1) {
      ambiguous[core] = Array.from(semantics);
    }
  }

  return ambiguous;
}

// Build the mappings
const hexToCore = buildHexToCore(coreTokens);
const contextMappings = buildContextMappings(semanticTokens);
const ambiguous = buildAmbiguous(contextMappings);

// Construct the final output
const output = {
  mappings: contextMappings,
  ambiguous,
  docsUrl: 'https://pine-design-system.netlify.app/?path=/docs/design-tokens-semantic-color--docs',
  hexToCore
};

// Write the output
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

console.log(`✅ Generated ${outputPath}`);

// Print summary
const totalHexMappings = Object.values(hexToCore).reduce((sum, group) => sum + Object.keys(group).length, 0);
const totalSemanticMappings = Object.values(contextMappings).reduce((sum, ctx) => sum + Object.keys(ctx).length, 0);
console.log(`   - ${totalHexMappings} hex → core token mappings`);
console.log(`   - ${totalSemanticMappings} core → semantic token mappings`);
console.log(`   - ${Object.keys(ambiguous).length} ambiguous tokens`);

