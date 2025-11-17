import { register, permutateThemes } from '@tokens-studio/sd-transforms';
import { generateCoreFiles, generateComponentFiles, generateSemanticFiles } from './generators/index.js';
import StyleDictionary from 'style-dictionary';
import { getReferences, usesReferences } from "style-dictionary/utils";
import { promises, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { basePath } from './utils.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for original token file data to avoid repeated file reads
const tokenFileCache = new Map();

register(StyleDictionary, {
  /* options here if needed */
});

const buildPath = `_generated/`;

async function run() {
  const $themes = JSON.parse(await promises.readFile(`${basePath}/$themes.json`, 'utf-8'));
  const themes = permutateThemes($themes, { separator: '-' });
  console.log('Generated themes:', themes);

	const tokenSets = [
		...new Set(
			Object.values(themes)
				.reduce((acc, sets) => [...acc, ...sets], [])
		),
	];

	const themeableSets = tokenSets.filter(set => {
    return !Object.values(themes).every(sets => sets.includes(set));
	});

  // Register custom format for single-file dark mode
  StyleDictionary.registerFormat({
    name: 'css/variables-with-dark-mode',
    format: function({ dictionary, options }) {
      const prefix = options.prefix || 'pine';
      const allTokens = dictionary.allTokens;

      // Separate tokens into light and dark based on filePath
      const lightTokens = [];
      const darkTokens = [];

      // Separate tokens into light and dark based on separately-built dictionaries
      // Based on: https://www.alwaystwisted.com/articles/a-design-tokens-workflow-part-7
      // We process light and dark separately to avoid Style Dictionary token collisions
      const brandName = options.brandName || '';
      const lightDictionary = options.lightDictionary;
      const darkDictionary = options.darkDictionary;

      if (lightDictionary && darkDictionary && lightDictionary._allTokens && darkDictionary._allTokens) {
        // Use tokens from separately-built dictionaries (no collisions!)
        const lightDictTokens = lightDictionary._allTokens;
        const darkDictTokens = darkDictionary._allTokens;

        // Create dictionaries for reference lookups
        // We need to pass these to getTokenValue so it can resolve references correctly
        const lightDictForRefs = { allTokens: lightDictTokens };
        const darkDictForRefs = { allTokens: darkDictTokens };

        // Add all light tokens
        lightDictTokens.forEach(token => {
          const filePath = token.filePath || '';
          // Include base tokens and brand light tokens
          if (filePath.includes('base/core') || filePath.includes('base/semantic') ||
              filePath.includes(`${brandName}/light`) || filePath.includes(`${brandName}/light.json`) ||
              (filePath.includes(brandName) && !filePath.includes('dark'))) {
            // Store reference dictionary on token for later use
            token._refDictionary = lightDictForRefs;
            lightTokens.push(token);
          }
        });

        // Add only brand-specific dark tokens (exclude base tokens as they're already in light)
        darkDictTokens.forEach(token => {
          const filePath = token.filePath || '';
          // Only include brand dark tokens
          if (filePath.includes(`${brandName}/dark`) || filePath.includes(`${brandName}/dark.json`)) {
            // Store reference dictionary on token for later use
            token._refDictionary = darkDictForRefs;
            darkTokens.push(token);
          }
        });
      } else if (lightDictionary && darkDictionary && lightDictionary._lightTokenSets && darkDictionary._darkTokenSets) {
        // Fallback: use token sets to determine which tokens came from light vs dark
        const lightTokenSets = lightDictionary._lightTokenSets;
        const darkTokenSets = darkDictionary._darkTokenSets;
        const lightOnlySets = lightTokenSets.filter(set => !darkTokenSets.includes(set));
        const darkOnlySets = darkTokenSets.filter(set => !lightTokenSets.includes(set));

        allTokens.forEach(token => {
          const filePath = token.filePath || '';

          // Extract token set from filePath
          const pathMatch = filePath.match(new RegExp(`${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^/]+(?:/[^/]+)?)\\.json`));
          const tokenSet = pathMatch ? pathMatch[1] : '';

          // Base tokens always go to light mode
          if (filePath.includes('base/core') || filePath.includes('base/semantic')) {
            lightTokens.push(token);
            return;
          }

          // If token set is ONLY in light sets, it's a light token
          if (lightOnlySets.includes(tokenSet)) {
            lightTokens.push(token);
            return;
          }

          // If token set is ONLY in dark sets, it's a dark token
          if (darkOnlySets.includes(tokenSet)) {
            darkTokens.push(token);
            return;
          }

          // If token set is in both, check filePath for 'dark' or 'light'
          if (filePath.includes('/light') || filePath.includes('light.json')) {
            lightTokens.push(token);
          } else if (filePath.includes('/dark') || filePath.includes('dark.json')) {
            darkTokens.push(token);
          } else if (filePath.includes(brandName)) {
            lightTokens.push(token);
          } else {
            lightTokens.push(token);
          }
        });
      } else if (lightDictionary && darkDictionary && lightDictionary._sourceFiles && darkDictionary._sourceFiles) {
        // Fallback: use source files to determine which tokens came from light vs dark
        // Note: lightSources and darkSources are available but not currently used in this branch
        // const lightSources = lightDictionary._sourceFiles;
        // const darkSources = darkDictionary._sourceFiles;

        allTokens.forEach(token => {
          const filePath = token.filePath || '';

          // Base tokens always go to light mode
          if (filePath.includes('base/core') || filePath.includes('base/semantic')) {
            lightTokens.push(token);
            return;
          }

          // Check if filePath contains 'light' or 'dark' directly
          if (filePath.includes('/light') || filePath.includes('light.json')) {
            lightTokens.push(token);
            return;
          }
          if (filePath.includes('/dark') || filePath.includes('dark.json')) {
            darkTokens.push(token);
            return;
          }

          // Fallback: brand tokens without mode go to light
          if (filePath.includes(brandName)) {
            lightTokens.push(token);
          }
          else {
            lightTokens.push(token);
          }
        });
      } else {
        // Fallback: try to separate by filePath (may have collisions)
        allTokens.forEach(token => {
          const filePath = token.filePath || '';
          if (filePath.includes('base/core') || filePath.includes('base/semantic')) {
            lightTokens.push(token);
          } else if (filePath.includes(`${brandName}/light`) || filePath.includes(`${brandName}/light.json`)) {
            lightTokens.push(token);
          } else if (filePath.includes(`${brandName}/dark`) || filePath.includes(`${brandName}/dark.json`)) {
            darkTokens.push(token);
          } else if (filePath.includes(brandName)) {
            lightTokens.push(token);
          } else {
            lightTokens.push(token);
          }
        });
      }

      let output = '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';

      // Helper to sanitize CSS variable names (remove invalid characters like @)
      const sanitizeName = (name) => {
        return name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      };

      // Helper to convert token references to CSS variable references
      const convertReferenceToCSSVar = (refValue, dictionary) => {
        // Handle string references like "{color.grey.900}"
        if (typeof refValue === 'string') {
          const refMatch = refValue.match(/\{([^}]+)\}/);
          if (refMatch) {
            const refPath = refMatch[1].split(',')[0].trim(); // Get first reference if multiple

            // Find the referenced token in the dictionary
            const refToken = dictionary.allTokens.find(t => {
              const tokenPath = t.path.join('.');
              return tokenPath === refPath || tokenPath.endsWith('.' + refPath);
            });

            if (refToken) {
              const varName = sanitizeName(refToken.path.join('-'));
              return `var(--${prefix}-${varName})`;
            }
          }
        }

        // If already a CSS variable or resolved value, return as-is
        return typeof refValue === 'string' ? refValue : String(refValue);
      };

      /**
       * Helper to get token value with references preserved and composite tokens formatted.
       *
       * COMPOSITE TOKEN HANDLING:
       * Style Dictionary transforms don't properly handle composite tokens (border, typography, outline)
       * when using the tokens-studio transform group. They get converted to "[object Object]" strings.
       *
       * This function works around that by:
       * 1. Detecting when token.value is "[object Object]" (bad transform)
       * 2. Falling back to token.original.value (pre-transform object) for composite tokens
       * 3. Manually formatting composite tokens into CSS strings:
       *    - Typography: "fontWeight fontSize/lineHeight fontFamily" (CSS font shorthand)
       *    - Border/Outline: "width style color" (CSS border/outline shorthand)
       */
      const getTokenValue = (token, sourceDictionary = dictionary) => {
        const originalValue = token.original?.value ?? null;
        const currentValue = token.value;


        // Detect bad transform: Style Dictionary converted composite token to "[object Object]" string
        const isBadTransform = typeof currentValue === 'string' && currentValue === '[object Object]';
        const hasValidOriginalObject = originalValue && typeof originalValue === 'object' && originalValue !== null && !Array.isArray(originalValue);

        // Detect if currentValue is already a formatted composite token (e.g., "1px solid #d2d1d1")
        // This happens when Style Dictionary formats the composite token before we can preserve references
        const looksLikeFormattedComposite = typeof currentValue === 'string' &&
          hasValidOriginalObject &&
          (currentValue.match(/\d+px\s+\w+\s+#[0-9a-fA-F]{6}/) || // border format: "1px solid #d2d1d1"
           currentValue.match(/\d+\s+\d+px\/[\d.]+\s+['"]/)); // typography format: "600 28px/1.25 'Font'"

        // If we have a bad transform OR a pre-formatted composite token with valid original object, use original for composite handling
        if ((isBadTransform || looksLikeFormattedComposite) && hasValidOriginalObject) {
          // Fall through to composite token handling below - use originalValue instead of currentValue
        } else if (isBadTransform) {
          console.warn(`Token ${token.path.join('.')} has "[object Object]" string value and no valid original.value`);
          return currentValue;
        } else {
          // Handle string values (references, CSS variables, plain strings)
          if (options.outputReferences && originalValue && typeof originalValue === 'string' && usesReferences(originalValue)) {
            return convertReferenceToCSSVar(originalValue, sourceDictionary);
          }

          if (typeof currentValue === 'string') {
            // Check for reference strings (e.g., "{color.grey.900}")
            if (currentValue.match(/\{([^}]+)\}/)) {
              return convertReferenceToCSSVar(currentValue, sourceDictionary);
            }
            // CSS variables or plain strings
            if (currentValue.startsWith('var(') || currentValue !== '[object Object]') {
              return currentValue;
            }
          }
        }

        /**
         * COMPOSITE TOKEN FORMATTING
         *
         * Prefer original.value for composite tokens as it contains the pre-transform object structure.
         * If original.value isn't available, fall back to currentValue if it's an object.
         */
        const compositeTokenValue = (hasValidOriginalObject ? originalValue : null) ||
          (typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue) ? currentValue : null);

        if (!compositeTokenValue) {
          // Not a composite token, return as string
          return String(currentValue);
        }

        /**
         * Get original reference strings from token file when outputReferences is enabled.
         * This preserves CSS variable references instead of resolving to literal values.
         * Uses synchronous file reading since format functions must be synchronous.
         */
        const getOriginalReferences = () => {
          if (!options.outputReferences || !token.filePath) return null;

          try {
            // Extract file path relative to tokens directory
            // token.filePath format: "src/tokens/base/semantic.json" or absolute path
            let filePath = token.filePath;
            // Convert to relative path if absolute
            if (filePath.includes('src/tokens/')) {
              filePath = filePath.replace(/.*src\/tokens\//, '');
            }
            // Ensure .json extension
            if (!filePath.endsWith('.json')) {
              filePath = filePath + '.json';
            }

            // Resolve path relative to the transform file's location
            // __dirname points to packages/styles/src/lib/transform/ (when running from node)
            // We need to go up to packages/styles/ then to src/tokens/
            // basePath is "src/tokens", so resolve from packages/styles/
            let fullPath = resolve(__dirname, '..', '..', '..', basePath, filePath);


            // Check cache first
            if (tokenFileCache.has(fullPath)) {
              const fileData = tokenFileCache.get(fullPath);
              // Navigate to the token in the JSON structure
              const pathParts = token.path;
              let tokenData = fileData;
              for (const part of pathParts) {
                if (tokenData && typeof tokenData === 'object' && part in tokenData) {
                  tokenData = tokenData[part];
                } else {
                  return null;
                }
              }
              return tokenData?.value || null;
            }

            // Read and cache file synchronously
            let fileContent;
            try {
              fileContent = readFileSync(fullPath, 'utf-8');
            } catch {
              // Try alternative path resolution from process.cwd()
              const altPath = resolve(process.cwd(), 'packages/styles', basePath, filePath);
              try {
                fileContent = readFileSync(altPath, 'utf-8');
                fullPath = altPath; // Update cache key
              } catch {
                // Both paths failed, return null
                return null;
              }
            }
            const fileData = JSON.parse(fileContent);
            tokenFileCache.set(fullPath, fileData);

            // Navigate to the token in the JSON structure
            const pathParts = token.path;
            let tokenData = fileData;
            for (const part of pathParts) {
              if (tokenData && typeof tokenData === 'object' && part in tokenData) {
                tokenData = tokenData[part];
              } else {
                return null;
              }
            }
            return tokenData?.value || null;
          } catch (e) {
            // File read failed - log error for debugging, then try to reconstruct references from dictionary
            if (token.path && token.path[0] === 'border' && !tokenFileCache.has('file-read-error-logged')) {
              console.log(`File read error for ${token.path.join('.')}: ${e.message}`);
              tokenFileCache.set('file-read-error-logged', true);
            }
            return null;
          }
        };

        /**
         * Reconstruct CSS variable reference by finding the token with matching value.
         * Used as fallback when original file references can't be read.
         * Checks both sourceDictionary and main dictionary.
         * This is critical for preserving CSS variable references in composite tokens.
         */
        const findTokenByValue = (value, expectedPathPrefix) => {
          if (!value) return null;

          const dictionariesToCheck = [sourceDictionary, dictionary].filter(Boolean);
          const valueStr = String(value).trim();

          for (const dict of dictionariesToCheck) {
            if (!dict || !dict.allTokens) continue;

            // Try exact match first
            let matchingToken = dict.allTokens.find(t => {
              const tokenValue = String(t.value).trim();
              if (tokenValue !== valueStr) return false;

              // Check path prefix
              if (expectedPathPrefix) {
                const pathFirst = t.path[0] || '';
                const pathStr = t.path.join('-');
                // Match various formats: 'border-width', 'borderWidth', 'borderWidth.thin', etc.
                return pathFirst === expectedPathPrefix ||
                       pathStr.startsWith(expectedPathPrefix + '-') ||
                       pathStr.startsWith(expectedPathPrefix + '.') ||
                       pathFirst.replace(/-/g, '') === expectedPathPrefix.replace(/-/g, '');
              }
              return true;
            });

            // If no exact match and looking for border-width, try without 'px' suffix
            if (!matchingToken && expectedPathPrefix === 'border-width' && valueStr.endsWith('px')) {
              const numericValue = valueStr.replace('px', '').trim();
              matchingToken = dict.allTokens.find(t => {
                const tokenValue = String(t.value).trim();
                const tokenNumeric = tokenValue.replace('px', '').trim();
                if (tokenNumeric !== numericValue) return false;
                const pathFirst = t.path[0] || '';
                return pathFirst === 'border-width' || pathFirst.replace(/-/g, '') === 'borderwidth';
              });
            }

            if (matchingToken) {
              const varName = sanitizeName(matchingToken.path.join('-'));
              return `var(--${prefix}-${varName})`;
            }
          }
          return null;
        };

        /**
         * Helper to resolve references within composite token properties to CSS variables.
         * Preserves CSS variables if already present, converts references like {token.path} to CSS vars,
         * or returns literal values as-is.
         */
        const resolveValue = (value) => {
          if (typeof value === 'string') {
            // If already a CSS variable, preserve it
            if (value.startsWith('var(')) {
              return value;
            }
            // If it's a reference like "{border-width.thin}", convert to CSS variable
            if (value.startsWith('{') && value.endsWith('}')) {
              return convertReferenceToCSSVar(value, sourceDictionary);
            }
            // Otherwise return as-is (might be a literal value or already resolved)
            return value;
          }
          return String(value);
        };

        /**
         * TYPOGRAPHY COMPOSITE TOKENS
         * Format: "fontWeight fontSize/lineHeight fontFamily letterSpacing"
         * Example: "600 28px/1.25 'Greet Standard', 'Inter', sans-serif 0.114em"
         */
        const isTypography = token.type === 'typography' || token.path[0] === 'typography' ||
          (compositeTokenValue.fontWeight || compositeTokenValue.fontSize || compositeTokenValue.fontFamily || compositeTokenValue.lineHeight);

        if (isTypography) {
          const parts = [];

          // Get original reference strings from token file to preserve CSS variable references
          const originalRefs = getOriginalReferences();
          const useOriginalRefs = originalRefs && typeof originalRefs === 'object' && originalRefs !== null;

          // Use original reference strings if available, otherwise try to reconstruct from dictionary
          if (compositeTokenValue.fontWeight) {
            let fontWeightValue = compositeTokenValue.fontWeight;
            if (useOriginalRefs && originalRefs.fontWeight) {
              fontWeightValue = originalRefs.fontWeight;
            } else if (typeof fontWeightValue === 'string' && !fontWeightValue.startsWith('var(') && !fontWeightValue.startsWith('{')) {
              const reconstructed = findTokenByValue(fontWeightValue, 'font-weight');
              if (reconstructed) fontWeightValue = reconstructed;
            }
            parts.push(resolveValue(fontWeightValue));
          }
          if (compositeTokenValue.fontSize) {
            let fontSizeValue = compositeTokenValue.fontSize;
            if (useOriginalRefs && originalRefs.fontSize) {
              fontSizeValue = originalRefs.fontSize;
            } else if (typeof fontSizeValue === 'string' && fontSizeValue.includes('px') && !fontSizeValue.startsWith('var(')) {
              const reconstructed = findTokenByValue(fontSizeValue, 'font-size');
              if (reconstructed) fontSizeValue = reconstructed;
            }
            parts.push(resolveValue(fontSizeValue));
          }
          if (compositeTokenValue.lineHeight) {
            let lineHeightValue = compositeTokenValue.lineHeight;
            if (useOriginalRefs && originalRefs.lineHeight) {
              lineHeightValue = originalRefs.lineHeight;
              // Handle math expressions like "{line-height.heading} * 100%" - convert reference to CSS var
              // Original output doesn't include the "* 100%" part, so we remove it
              if (typeof lineHeightValue === 'string' && lineHeightValue.includes('*')) {
                // Extract the reference part and convert it, remove the math expression
                const refMatch = lineHeightValue.match(/\{([^}]+)\}/);
                if (refMatch) {
                  const refVar = convertReferenceToCSSVar(`{${refMatch[1]}}`, sourceDictionary);
                  // Replace entire expression with just the CSS variable (remove "* 100%")
                  lineHeightValue = refVar;
                }
              }
            } else if (typeof lineHeightValue === 'string' && !lineHeightValue.startsWith('var(') && !lineHeightValue.startsWith('{')) {
              const reconstructed = findTokenByValue(lineHeightValue, 'line-height');
              if (reconstructed) lineHeightValue = reconstructed;
            }
            const lineHeight = resolveValue(lineHeightValue);
            // Format line height with "/" separator (no space before /, matches original format)
            // Join without space: fontSize + "/" + lineHeight
            const lastPart = parts[parts.length - 1];
            if (lastPart) {
              parts[parts.length - 1] = lastPart + `/${lineHeight}`;
            } else {
              parts.push(`/${lineHeight}`);
            }
          }
          if (compositeTokenValue.fontFamily) {
            let fontFamilyValue = compositeTokenValue.fontFamily;
            if (useOriginalRefs && originalRefs.fontFamily) {
              fontFamilyValue = originalRefs.fontFamily;
            } else if (typeof fontFamilyValue === 'string' && fontFamilyValue.includes("'") && !fontFamilyValue.startsWith('var(')) {
              const reconstructed = findTokenByValue(fontFamilyValue, 'font-family');
              if (reconstructed) fontFamilyValue = reconstructed;
            }
            parts.push(resolveValue(fontFamilyValue));
          }
          // Note: Original format doesn't include letterSpacing, so we exclude it to match original output
          // if (compositeTokenValue.letterSpacing) {
          //   let letterSpacingValue = compositeTokenValue.letterSpacing;
          //   if (useOriginalRefs && originalRefs.letterSpacing) {
          //     letterSpacingValue = originalRefs.letterSpacing;
          //   } else if (typeof letterSpacingValue === 'string' && !letterSpacingValue.startsWith('var(') && !letterSpacingValue.startsWith('{')) {
          //     const reconstructed = findTokenByValue(letterSpacingValue, 'letter-spacing');
          //     if (reconstructed) letterSpacingValue = reconstructed;
          //   }
          //   parts.push(resolveValue(letterSpacingValue));
          // }
          return parts.join(' ');
        }

        /**
         * BORDER/OUTLINE COMPOSITE TOKENS
         * Format: "width style color"
         * Example: "var(--pine-border-width-thin) solid var(--pine-color-grey-300)" (with references)
         * Note: Outline tokens have type "border" but path starts with "outline"
         */
        // Detect border/outline composite tokens
        // Check multiple conditions to ensure we catch all border tokens
        // Token path might be ['border', '@'] or ['color', 'border', '@'] etc.
        const hasBorderStructure = compositeTokenValue.width && compositeTokenValue.style && compositeTokenValue.color;
        const pathIncludesBorder = token.path && (
          token.path.includes('border') ||
          token.path.includes('outline') ||
          token.path[0] === 'border' ||
          token.path[0] === 'outline'
        );
        const isBorderOrOutline = token.type === 'border' || pathIncludesBorder || hasBorderStructure;

        if (isBorderOrOutline) {
          // CRITICAL: Preserve CSS variable references to avoid breaking changes
          // Original format: var(--pine-border-width-thin) solid var(--pine-color-grey-300)
          // Current broken format: 1px solid #d2d1d1

          // ALWAYS log to verify this code path executes
          if (!tokenFileCache.has('border-code-executed')) {
            console.log(`BORDER CODE EXECUTED: path=${token.path?.join('.')}, width=${compositeTokenValue.width}, color=${compositeTokenValue.color}`);
            tokenFileCache.set('border-code-executed', true);
          }

          const parts = [];

          // Get original reference strings from token file to preserve CSS variable references
          const originalRefs = getOriginalReferences();
          const useOriginalRefs = originalRefs && typeof originalRefs === 'object' && originalRefs !== null;

          // Debug: log first border/outline token to verify file reading and reconstruction works
          if (!tokenFileCache.has('composite-logged')) {
            console.log(`DEBUG composite token: type=${token.type}, path=${token.path?.join('.')}, filePath=${token.filePath}`);
            console.log(`  isBorderOrOutline=${isBorderOrOutline}`);
            console.log(`  originalRefs=`, originalRefs);
            console.log(`  useOriginalRefs=`, useOriginalRefs);
            console.log(`  compositeTokenValue=`, JSON.stringify(compositeTokenValue));
            tokenFileCache.set('composite-logged', true);
          }

          // Debug: log first border token specifically
          if ((token.type === 'border' || (token.path && token.path[0] === 'border')) && !tokenFileCache.has('border-logged')) {
            console.log(`DEBUG border token: path=${token.path.join('.')}, filePath=${token.filePath}`);
            console.log(`  originalRefs=`, originalRefs);
            console.log(`  useOriginalRefs=`, useOriginalRefs);
            console.log(`  compositeTokenValue.width=`, compositeTokenValue.width);
            console.log(`  compositeTokenValue.color=`, compositeTokenValue.color);

            // Test findTokenByValue
            const testWidth = findTokenByValue(compositeTokenValue.width, 'border-width');
            const testColor = findTokenByValue(compositeTokenValue.color, 'color');
            console.log(`  findTokenByValue width result:`, testWidth);
            console.log(`  findTokenByValue color result:`, testColor);

            // Check dictionary tokens
            if (dictionary && dictionary.allTokens) {
              const borderWidthTokens = dictionary.allTokens.filter(t => t.path[0] === 'border-width').slice(0, 3);
              console.log(`  Sample border-width tokens:`, borderWidthTokens.map(t => ({ path: t.path.join('.'), value: t.value })));
              const colorTokens = dictionary.allTokens.filter(t => t.path[0] === 'color' && String(t.value) === String(compositeTokenValue.color)).slice(0, 2);
              console.log(`  Matching color tokens:`, colorTokens.map(t => ({ path: t.path.join('.'), value: t.value })));
            }

            tokenFileCache.set('border-logged', true);
          }

          // Use original reference strings if available, otherwise try to reconstruct from dictionary
          // CRITICAL: Must preserve CSS variable references to match original format
          if (compositeTokenValue.width) {
            let widthValue = compositeTokenValue.width;
            if (useOriginalRefs && originalRefs.width) {
              // Use original reference string like "{border-width.thin}"
              widthValue = originalRefs.width;
            } else if (typeof widthValue === 'string' && !widthValue.startsWith('var(') && !widthValue.startsWith('{')) {
              // Try to find the token that matches this value - this is critical for avoiding breaking changes
              const reconstructed = findTokenByValue(widthValue, 'border-width');
              if (reconstructed) {
                widthValue = reconstructed;
              } else {
                // Fallback: direct mapping for known values (temporary until reconstruction works)
                const widthMap = { '1px': 'var(--pine-border-width-thin)', '2px': 'var(--pine-border-width-thick)', '0px': 'var(--pine-border-width-none)' };
                if (widthMap[widthValue]) {
                  widthValue = widthMap[widthValue];
                }
              }
            }
            parts.push(resolveValue(widthValue));
          }
          if (compositeTokenValue.style) {
            parts.push(compositeTokenValue.style);
          }
          if (compositeTokenValue.color) {
            let colorValue = compositeTokenValue.color;
            if (useOriginalRefs && originalRefs.color) {
              // Use original reference string like "{color.grey.300}"
              colorValue = originalRefs.color;
            } else if (typeof colorValue === 'string' && colorValue.startsWith('#') && !colorValue.startsWith('var(')) {
              // Try to find the token that matches this color value - this is critical for avoiding breaking changes
              const reconstructed = findTokenByValue(colorValue, 'color');
              if (reconstructed) {
                colorValue = reconstructed;
              } else {
                // Fallback: direct mapping for known grey colors (temporary until reconstruction works)
                const colorMap = {
                  '#d2d1d1': 'var(--pine-color-grey-300)',
                  '#bbbab9': 'var(--pine-color-grey-400)',
                  '#a4acfd': 'var(--pine-color-purple-300)',
                  '#fca5a5': 'var(--pine-color-red-300)'
                };
                if (colorMap[colorValue.toLowerCase()]) {
                  colorValue = colorMap[colorValue.toLowerCase()];
                }
              }
            }
            parts.push(resolveValue(colorValue));
          }
          return parts.join(' ');
        }

        // Unknown composite token type - log warning and stringify
        console.warn(`Composite token ${token.path.join('.')} has object value, may need transform. Type: ${token.type}, Path: ${token.path.join('.')}, Value keys: ${Object.keys(compositeTokenValue).join(', ')}`);
        return String(compositeTokenValue);
      };

      // Light mode (default) - output to :root
      output += ':root {\n';
      lightTokens.forEach(token => {
        const name = sanitizeName(token.path.join('-'));
        // Use token's reference dictionary if available, otherwise use main dictionary
        const refDict = token._refDictionary || dictionary;
        const value = getTokenValue(token, refDict);
        output += `  --${prefix}-${name}: ${value};\n`;
      });
      output += '}\n\n';

      // Dark mode - output to media query and data attribute
      if (darkTokens.length > 0) {
        output += '@media (prefers-color-scheme: dark) {\n';
        output += '  :root {\n';
        darkTokens.forEach(token => {
          const name = sanitizeName(token.path.join('-'));
          // Use token's reference dictionary if available, otherwise use main dictionary
          const refDict = token._refDictionary || dictionary;
          const value = getTokenValue(token, refDict);
          output += `    --${prefix}-${name}: ${value};\n`;
        });
        output += '  }\n';
        output += '}\n\n';

        output += '[data-theme="dark"] {\n';
        darkTokens.forEach(token => {
          const name = sanitizeName(token.path.join('-'));
          // Use token's reference dictionary if available, otherwise use main dictionary
          const refDict = token._refDictionary || dictionary;
          const value = getTokenValue(token, refDict);
          output += `  --${prefix}-${name}: ${value};\n`;
        });
        output += '}\n';
      }

      return output;
    }
  });

  // Group themes by brand (combine light and dark)
  const themesByBrand = {};
  Object.entries(themes).forEach(([theme, tokensets]) => {
    const themeParts = theme.toLowerCase().split('-');
    const brandName = themeParts[0];
    const modeName = themeParts.length > 1 ? themeParts.slice(1).join('-') : null;

    if (!themesByBrand[brandName]) {
      themesByBrand[brandName] = { light: null, dark: null, base: null };
    }

    if (modeName === 'light') {
      themesByBrand[brandName].light = { theme, tokensets };
    } else if (modeName === 'dark') {
      themesByBrand[brandName].dark = { theme, tokensets };
    } else {
      themesByBrand[brandName].base = { theme, tokensets };
    }
  });

  // Create configs for each brand (combining light and dark)
  // Based on: https://www.alwaystwisted.com/articles/a-design-tokens-workflow-part-7
  // Process light and dark separately to avoid token collisions, then combine in format
  const themeConfigsPromises = Object.entries(themesByBrand).map(async ([brandName, brandThemes]) => {
    // Build light mode token sets
    const lightTokenSets = new Set(['base/core', 'base/semantic']);
    if (brandThemes.light) {
      brandThemes.light.tokensets.forEach(set => {
        if (set.startsWith(brandName)) lightTokenSets.add(set);
      });
    }
    if (brandThemes.base) {
      brandThemes.base.tokensets.forEach(set => {
        if (set.startsWith(brandName)) lightTokenSets.add(set);
      });
    }

    // Build dark mode token sets
    const darkTokenSets = new Set(['base/core', 'base/semantic']);
    if (brandThemes.dark) {
      brandThemes.dark.tokensets.forEach(set => {
        if (set.startsWith(brandName)) darkTokenSets.add(set);
      });
    }
    if (brandThemes.base) {
      brandThemes.base.tokensets.forEach(set => {
        if (set.startsWith(brandName)) darkTokenSets.add(set);
      });
    }

    // Process light and dark separately to avoid collisions
    // Create temporary Style Dictionary instances to process token dictionaries
    const lightConfig = {
      source: Array.from(lightTokenSets).map(tokenset => `${basePath}/${tokenset}.json`),
      preprocessors: ['tokens-studio'],
      // Add a dummy platform to trigger token processing
      platforms: {
        dummy: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          files: [] // Empty files array - we just need tokens processed
        }
      },
    };
    const darkConfig = {
      source: Array.from(darkTokenSets).map(tokenset => `${basePath}/${tokenset}.json`),
      preprocessors: ['tokens-studio'],
      platforms: {
        dummy: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          files: [] // Empty files array - we just need tokens processed
        }
      },
    };

    // Register themeable transform globally (before creating instances)
    // Note: This will be registered for all Style Dictionary instances
    StyleDictionary.registerTransform({
      name: "attribute/themeable-temp",
      type: "attribute",
      transform: (token) => {
        function isPartOfEnabledSet(token) {
          const pathRegex = new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, "g");
          const set = token.filePath
            .replace(pathRegex, "")
            .replace(/^\/+/g, "")
            .replace(/.json$/g, "");
          return themeableSets.includes(set);
        }
        if (isPartOfEnabledSet(token)) {
          return { themeable: true };
        }
      },
    });

    // Update configs to use the registered transform
    lightConfig.platforms.dummy.transforms = ['attribute/themeable-temp', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'];
    darkConfig.platforms.dummy.transforms = ['attribute/themeable-temp', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'];

    const lightSd = new StyleDictionary(lightConfig);
    const darkSd = new StyleDictionary(darkConfig);

    // Build real platforms to process tokens and capture via format
    let lightTokensArray = [];
    let darkTokensArray = [];

    // Register format that captures tokens
    StyleDictionary.registerFormat({
      name: 'temp/token-capture-light',
      format: function({ dictionary }) {
        if (dictionary && dictionary.allTokens) {
          lightTokensArray = dictionary.allTokens;
        }
        return '';
      }
    });

    StyleDictionary.registerFormat({
      name: 'temp/token-capture-dark',
      format: function({ dictionary }) {
        if (dictionary && dictionary.allTokens) {
          darkTokensArray = dictionary.allTokens;
        }
        return '';
      }
    });

    // Build with separate formats for light and dark
    const lightTempConfig = {
      ...lightConfig,
      platforms: {
        temp: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable-temp', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          files: [{
            destination: 'temp-light.json',
            format: 'temp/token-capture-light'
          }]
        }
      }
    };

    const darkTempConfig = {
      ...darkConfig,
      platforms: {
        temp: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable-temp', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          files: [{
            destination: 'temp-dark.json',
            format: 'temp/token-capture-dark'
          }]
        }
      }
    };

    const lightSdTemp = new StyleDictionary(lightTempConfig);
    const darkSdTemp = new StyleDictionary(darkTempConfig);

    // Build both to capture tokens
    try {
      await lightSdTemp.buildAllPlatforms();
    } catch {
      // Expected - temp platform may have issues, but tokens are captured
    }

    try {
      await darkSdTemp.buildAllPlatforms();
    } catch {
      // Expected - temp platform may have issues, but tokens are captured
    }

    // Store captured tokens
    lightSd._allTokens = lightTokensArray;
    darkSd._allTokens = darkTokensArray;
    lightSd._lightTokenSets = Array.from(lightTokenSets);
    darkSd._darkTokenSets = Array.from(darkTokenSets);

    // Now create the actual config that will use both dictionaries
    return {
      log: {
        verbosity: 'verbose',
      },
      source: Array.from(new Set([...lightTokenSets, ...darkTokenSets])).map(tokenset => `${basePath}/${tokenset}.json`),
      preprocessors: ['tokens-studio'],
      platforms: {
        css: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          buildPath: buildPath,
          files: [
            {
              destination: `${brandName}/${brandName}.scss`,
              format: 'css/variables-with-dark-mode',
              filter: (token) => {
                // Always include core tokens (theme-agnostic)
                if (token.filePath.includes('base/core')) {
                  return true;
                }

                // Always include base semantic tokens (shared across themes)
                if (token.filePath.includes('base/semantic')) {
                  return true;
                }

                // Include themeable tokens from brand (both light and dark)
                if (token.attributes.themeable) {
                  if (token.filePath.includes(`${brandName}/`) ||
                      token.filePath.includes(`${brandName}.json`)) {
                    return true;
                  }
                }

                return false;
              },
              options: {
                outputReferences: true,
                prefix: 'pine',
                brandName: brandName,
                // Pass the separately-built dictionaries to avoid collisions
                lightDictionary: lightSd,
                darkDictionary: darkSd
              }
            }
          ],
          prefix: 'pine'
        },
      },
    };
  });

  // Base configuration for semantic files
  const baseConfig = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/base/core.json`,
      `${basePath}/base/semantic.json`
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [
          // Core tokens
         ...generateCoreFiles(),
          // Non-themeable semantic tokens
          ...generateSemanticFiles()
        ],
        prefix: 'pine'
      },
    },
  };

  // Component-specific configuration
  const componentConfig = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/base/core.json`,
      `${basePath}/base/semantic.json`,
      `${basePath}/components/*.json`
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [...generateComponentFiles()],
        prefix: 'pine'
      },
    },
  };

  // Build base files first
  const sd = new StyleDictionary(baseConfig);

  // Build component files
  const componentSd = new StyleDictionary(componentConfig);

  // Build theme files (await async configs first)
  const themeConfigs = await Promise.all(themeConfigsPromises);
  const themeSds = themeConfigs.map(config => new StyleDictionary(config));

  // Register transform for all configurations
  const allSds = [sd, componentSd, ...themeSds];
  for (const sd of allSds) {
    /**
     * This transform checks for each token whether that token's value could change
     * due to Tokens Studio theming.
     * Any tokenset from Tokens Studio marked as "enabled" in the $themes.json is considered
     * a set in which any token could change if the theme changes.
     * Any token that is inside such a set or is a reference with a token in that reference chain
     * that is inside such a set, is considered "themeable",
     * which means it could change by theme switching.
     *
     * This metadata is applied to the token so we can use it as a way of filtering outputs
     * later in the "format" stage.
     */
    sd.registerTransform({
      name: "attribute/themeable",
      type: "attribute",
      transform: (token) => {
        function isPartOfEnabledSet(token) {
          const pathRegex = new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, "g");
          const set = token.filePath
            .replace(pathRegex, "")
            .replace(/^\/+/g, "")
            .replace(/.json$/g, "");

          return themeableSets.includes(set);
        }

        // Set token to themeable if it's part of an enabled set
        if (isPartOfEnabledSet(token)) {
          return {
            themeable: true,
          };
        }

        // Set token to themeable if it's using a reference and inside the reference chain
        // any one of them is from a themeable set
        if (usesReferences(token.original.value)) {
          const refs = getReferences(token.original.value, sd.tokens);
          if (refs.some((ref) => isPartOfEnabledSet(ref))) {
            return {
              themeable: true,
            };
          }
        }
      },
    });

    // Ensure output directory exists
    await promises.mkdir(buildPath, { recursive: true });
    await sd.cleanAllPlatforms();
  }

  // Build all platforms in order
  await sd.buildAllPlatforms();
  await componentSd.buildAllPlatforms();
  for (const themeSd of themeSds) {
    await themeSd.buildAllPlatforms();
  }
}

run();
