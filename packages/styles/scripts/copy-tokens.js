#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import * as globModule from 'glob';
import { fileURLToPath } from 'url';

const { glob } = globModule;

// Get directory info for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Define paths
const sourceDir = path.join(rootDir, 'src', 'tokens', 'base');
const destDir = path.join(rootDir, 'dist', 'tokens');

console.log('Copying token files to dist/tokens...');

// Ensure the destination directory exists
fs.ensureDirSync(destDir);

// Find all JSON files in source directory
const jsonFiles = glob.sync('**/*.json', { cwd: sourceDir });

if (jsonFiles.length === 0) {
  console.warn('No JSON token files found in src/tokens/base/');
}

// Copy each JSON file
jsonFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);
  
  // Ensure the destination directory structure exists
  fs.ensureDirSync(path.dirname(destPath));
  
  // Copy the file
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied: ${file}`);
});

console.log('✅ Token files copied successfully to dist/tokens/');
