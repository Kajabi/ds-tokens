#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory info for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Define paths
const tokensDir = path.join(rootDir, 'src', 'tokens');
const destDir = path.join(rootDir, 'dist', 'tokens');

console.log('Copying token files to dist/tokens...');

// Ensure the destination directory exists
fs.ensureDirSync(destDir);

let copiedCount = 0;

// Copy core tokens from brand/core.json
const coreSource = path.join(tokensDir, 'brand', 'core.json');
if (fs.existsSync(coreSource)) {
  fs.copyFileSync(coreSource, path.join(destDir, 'core.json'));
  console.log('Copied: brand/core.json → core.json');
  copiedCount++;
} else {
  console.warn('Warning: brand/core.json not found');
}

// Copy semantic tokens from semantic/light.json as semantic.json (for backwards compatibility)
const semanticLightSource = path.join(tokensDir, 'semantic', 'light.json');
if (fs.existsSync(semanticLightSource)) {
  fs.copyFileSync(semanticLightSource, path.join(destDir, 'semantic.json'));
  console.log('Copied: semantic/light.json → semantic.json');
  copiedCount++;
} else {
  console.warn('Warning: semantic/light.json not found');
}

// Copy dark theme tokens for future dark mode support
const semanticDarkSource = path.join(tokensDir, 'semantic', 'dark.json');
if (fs.existsSync(semanticDarkSource)) {
  fs.copyFileSync(semanticDarkSource, path.join(destDir, 'semantic-dark.json'));
  console.log('Copied: semantic/dark.json → semantic-dark.json');
  copiedCount++;
} else {
  console.warn('Warning: semantic/dark.json not found');
}

if (copiedCount === 0) {
  console.error('❌ No token files were copied!');
  process.exit(1);
}

console.log(`✅ ${copiedCount} token file(s) copied successfully to dist/tokens/`);
