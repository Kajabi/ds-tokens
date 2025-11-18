import { register, permutateThemes } from '@tokens-studio/sd-transforms';
import { generateCoreFiles, generateComponentFiles, generateSemanticFiles } from './generators/index.js';
import StyleDictionary from 'style-dictionary';
import { getReferences, usesReferences } from "style-dictionary/utils";
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { basePath } from './utils.js';

register(StyleDictionary, {
  /* options here if needed */
});

const buildPath = `_generated/`;

// Custom format for CSS variables with dark mode support via media queries
StyleDictionary.registerFormat({
  name: 'css/variables-with-dark-mode',
  format: function({ dictionary, options }) {
    const prefix = options.prefix || 'pine';
    const mode = options.mode || 'all'; // 'light', 'dark', or 'all'
    const allTokens = dictionary.allTokens;

    // Helper to sanitize CSS variable names
    const sanitizeName = (name) => {
      return name.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    };

    // Helper to convert token references to CSS variable references
    const formatTokenValue = (token, prefix) => {
      const originalValue = token.original?.value || token.value;

      // Check if the original value is a reference (starts with {)
      if (typeof originalValue === 'string' && originalValue.startsWith('{') && originalValue.endsWith('}')) {
        // Convert {color.purple.500} to var(--pine-color-purple-500)
        const refPath = originalValue.slice(1, -1); // Remove { and }
        const varName = sanitizeName(refPath.split('.').join('-'));
        return `var(--${prefix}-${varName})`;
      }

      // If not a reference, use the resolved value
      return token.value;
    };

    let output = '';

    // If mode is 'light' or 'all', output light tokens to :root
    if (mode === 'light' || mode === 'all') {
      const lightTokens = allTokens.filter(token => {
        const filePath = token.filePath || '';
        const originalPath = token.original?.filePath || filePath;
        const checkPath = originalPath || filePath;

        // Exclude dark tokens
        return !(checkPath.includes('/dark.json') ||
                 checkPath.includes('/dark/') ||
                 checkPath.endsWith('dark.json') ||
                 checkPath.match(/\/dark(\.json)?$/i) ||
                 checkPath.match(/dark\.json/i));
      });

      if (lightTokens.length > 0) {
        if (mode === 'light') {
          output += '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';
        }
        output += ':root {\n';
        lightTokens.forEach(token => {
          const name = sanitizeName(token.path.join('-'));
          const value = formatTokenValue(token, prefix);
          output += `  --${prefix}-${name}: ${value};\n`;
        });
        output += '}\n';
        if (mode === 'light') {
          output += '\n';
        }
      }
    }

    // If mode is 'dark' or 'all', output dark tokens to media query
    if (mode === 'dark' || mode === 'all') {
      const darkTokens = allTokens.filter(token => {
        const filePath = token.filePath || '';
        const originalPath = token.original?.filePath || filePath;
        const checkPath = originalPath || filePath;

        // Include only dark tokens
        return checkPath.includes('/dark.json') ||
               checkPath.includes('/dark/') ||
               checkPath.endsWith('dark.json') ||
               checkPath.match(/\/dark(\.json)?$/i) ||
               checkPath.match(/dark\.json/i);
      });

      if (darkTokens.length > 0) {
        if (mode === 'dark') {
          output += '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';
        }
        if (mode === 'all' && output) {
          output += '\n';
        }
        output += '@media (prefers-color-scheme: dark) {\n';
        output += '  :root {\n';
        darkTokens.forEach(token => {
          const name = sanitizeName(token.path.join('-'));
          const value = formatTokenValue(token, prefix);
          output += `    --${prefix}-${name}: ${value};\n`;
        });
        output += '  }\n';
        output += '}\n\n';

        output += '[data-theme="dark"] {\n';
        darkTokens.forEach(token => {
          const name = sanitizeName(token.path.join('-'));
          const value = formatTokenValue(token, prefix);
          output += `  --${prefix}-${name}: ${value};\n`;
        });
        output += '}\n';
      }
    }

    return output;
  }
});

async function run() {
  const $themes = JSON.parse(await fs.readFile(`${basePath}/$themes.json`, 'utf-8'));
  const allThemes = permutateThemes($themes, { separator: '-' });
  console.log('All permutated themes:', Object.keys(allThemes));

  // Filter themes to only include valid brand-mode combinations
  // Valid themes: kajabi_products-light, kajabi_products-dark, pine-light, pine-dark
  // The permutateThemes creates themes like "light-light", "dark-dark" from pine group themes
  // We need to map these to "pine-light" and "pine-dark" based on the group property
  const validBrands = ['kajabi_products', 'pine'];
  const validModes = ['light', 'dark'];
  const themes = {};

  // Create a map of theme IDs to their group
  const themeGroups = {};
  $themes.forEach(theme => {
    if (theme.group) {
      themeGroups[theme.id] = theme.group;
    }
  });

  Object.entries(allThemes).forEach(([themeName, tokensets]) => {
    const themeParts = themeName.toLowerCase().split('-');
    const firstPart = themeParts[0];
    const secondPart = themeParts.slice(1).join('-');

    let brandName, modeName;

    // Handle kajabi_products themes (already have brand in name)
    if (firstPart === 'kajabi_products' && validModes.includes(secondPart)) {
      brandName = 'kajabi_products';
      modeName = secondPart;
      themes[themeName] = tokensets;
    }
    // Handle pine themes (group is "pine", name is "light" or "dark")
    // permutateThemes creates "light-light", "dark-dark", etc. from these
    // We need to check if this is a valid pine theme combination
    else if (validModes.includes(firstPart) && validModes.includes(secondPart)) {
      // This is likely a pine theme (light-light, dark-dark, etc.)
      // We want pine-light and pine-dark, so check if first and second parts match
      if (firstPart === secondPart) {
        brandName = 'pine';
        modeName = firstPart;
        const pineThemeName = `pine-${modeName}`;
        themes[pineThemeName] = tokensets;
      }
    }
  });

  console.log('Filtered themes:', Object.keys(themes));

	const tokenSets = [
		...new Set(
			Object.values(themes)
				.reduce((acc, sets) => [...acc, ...sets], [])
		),
	];

	const themeableSets = tokenSets.filter(set => {
    return !Object.values(themes).every(sets => sets.includes(set));
	});

  // Base configuration for core files with light and dark mode support
  // Process light and dark separately to avoid token collisions, then combine in format
  const coreConfigLight = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/core/light.json`
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [
          {
            destination: `base/_core.scss`,
            format: 'css/variables-with-dark-mode',
            filter: token => token.filePath.includes('core/light'),
            options: {
              outputReferences: true,
              prefix: 'pine',
              mode: 'light'
            }
          }
        ],
        prefix: 'pine'
      },
    },
  };

  const coreConfigDark = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/core/light.json`, // Include light for reference resolution
      `${basePath}/core/dark.json`
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [
          {
            destination: `base/_core-dark.scss`,
            format: 'css/variables-with-dark-mode',
            filter: token => token.filePath.includes('core/dark'),
            options: {
              outputReferences: true,
              prefix: 'pine',
              mode: 'dark'
            }
          }
        ],
        prefix: 'pine'
      },
    },
  };

  // Base configuration for semantic files with light and dark mode support
  // Include core files for reference resolution
  // Process light and dark separately to avoid token collisions
  const semanticConfigLight = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/core/light.json`,
      `${basePath}/semantic/light.json`
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [
          {
            destination: `base/_semantic.scss`,
            format: 'css/variables-with-dark-mode',
            filter: token => token.filePath.includes('semantic/light'),
            options: {
              outputReferences: true,
              prefix: 'pine',
              mode: 'light'
            }
          }
        ],
        prefix: 'pine'
      },
    },
  };

  const semanticConfigDark = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/core/light.json`, // Include for reference resolution
      `${basePath}/core/dark.json`,
      `${basePath}/semantic/light.json`, // Include for reference resolution
      `${basePath}/semantic/dark.json`
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [
          {
            destination: `base/_semantic-dark.scss`,
            format: 'css/variables-with-dark-mode',
            filter: token => token.filePath.includes('semantic/dark'),
            options: {
              outputReferences: true,
              prefix: 'pine',
              mode: 'dark'
            }
          }
        ],
        prefix: 'pine'
      },
    },
  };

  // Component-specific configuration
  // Components have light/dark variants, so we need to handle them per theme
  const componentConfig = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/core/light.json`,
      `${basePath}/core/dark.json`,
      `${basePath}/semantic/light.json`,
      `${basePath}/semantic/dark.json`,
      `${basePath}/components/**/*.json`
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

  // Theme-specific configuration
  // Each theme is structured as {brand}-{mode} (e.g., kajabi_products-light, pine-dark)
  // These handle brand-specific tokens only (not core/semantic which are handled above)
  const themeConfigs = Object.entries(themes).map(([theme, tokensets]) => {
    // Extract brand and mode from theme name
    const themeParts = theme.toLowerCase().split('-');
    const brandName = themeParts[0];
    const modeName = themeParts.slice(1).join('-') || null;

    // Determine file destination
    // Both kajabi_products and pine files go in their respective brand folders
    let fileDestination;
    if (brandName === 'kajabi_products' || brandName === 'pine') {
      fileDestination = `${brandName}/${modeName}.scss`;
    } else {
      fileDestination = `${theme}/${theme}.scss`;
    }

    // Build source files - only include brand-specific and component tokens for this mode
    const sourceFiles = [];

    // Include core and semantic for reference resolution
    sourceFiles.push(`${basePath}/core/light.json`);
    sourceFiles.push(`${basePath}/core/dark.json`);
    sourceFiles.push(`${basePath}/semantic/light.json`);
    sourceFiles.push(`${basePath}/semantic/dark.json`);

    // Add brand-specific tokens
    tokensets.forEach(set => {
      if (set.includes(brandName) && !set.includes('core/') && !set.includes('semantic/')) {
        sourceFiles.push(`${basePath}/${set}.json`);
      }
      // Add component tokens for this mode
      if (set.includes('components/') && modeName && set.includes(`/${modeName}`)) {
        sourceFiles.push(`${basePath}/${set}.json`);
      }
    });

    return {
      log: {
        verbosity: 'verbose',
      },
      source: sourceFiles,
      preprocessors: ['tokens-studio'],
      platforms: {
        css: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          buildPath: buildPath,
          files: [
            {
              destination: fileDestination,
              format: 'css/variables-with-dark-mode',
              filter: (token) => {
                const filePath = token.filePath || '';

                // Exclude core and semantic (handled separately)
                if (filePath.includes('core/') || filePath.includes('semantic/')) {
                  return false;
                }

                // Include brand-specific tokens
                if (filePath.includes(`${brandName}.json`) ||
                    (filePath.includes(`${brandName}/`) && !filePath.includes('/light') && !filePath.includes('/dark'))) {
                  return true;
                }

                // Include component tokens for this mode
                if (modeName && filePath.includes(`components/`) && filePath.includes(`/${modeName}`)) {
                  return true;
                }

                // Include themeable tokens that match this brand
                if (token.attributes?.themeable) {
                  const tokenSet = filePath
                    .replace(new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`), '')
                    .replace(/\.json$/, '');

                  if (tokensets.includes(tokenSet) && !tokenSet.includes('core/') && !tokenSet.includes('semantic/')) {
                    return true;
                  }
                }

                return false;
              },
              options: {
                outputReferences: true,
                prefix: 'pine'
              }
            }
          ],
          prefix: 'pine'
        },
      },
    };
  });

  // Build core files (light and dark separately)
  const coreSdLight = new StyleDictionary(coreConfigLight);
  const coreSdDark = new StyleDictionary(coreConfigDark);

  // Build semantic files (light and dark separately)
  const semanticSdLight = new StyleDictionary(semanticConfigLight);
  const semanticSdDark = new StyleDictionary(semanticConfigDark);

  // Build component files
  const componentSd = new StyleDictionary(componentConfig);

  // Build theme files
  const themeSds = themeConfigs.map(config => new StyleDictionary(config));

  // Register transform for all configurations
  const allSds = [coreSdLight, coreSdDark, semanticSdLight, semanticSdDark, componentSd, ...themeSds];
  for (const sd of allSds) {
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
    await fs.mkdir(buildPath, { recursive: true });
    await sd.cleanAllPlatforms();
  }

  // Build all platforms in order
  // Build light first to temp files, then dark to temp files, then combine
  await coreSdLight.buildAllPlatforms();
  await coreSdDark.buildAllPlatforms();
  await semanticSdLight.buildAllPlatforms();
  await semanticSdDark.buildAllPlatforms();

  // Combine light and dark outputs for core and semantic files
  const coreLightPath = resolve(buildPath, 'base/_core.scss');
  const coreDarkPath = resolve(buildPath, 'base/_core-dark.scss');
  const semanticLightPath = resolve(buildPath, 'base/_semantic.scss');
  const semanticDarkPath = resolve(buildPath, 'base/_semantic-dark.scss');

  try {
    // Combine core files
    const coreLightContent = await fs.readFile(coreLightPath, 'utf-8');
    const coreDarkContent = await fs.readFile(coreDarkPath, 'utf-8');
    // Remove header from dark content and combine
    const coreDarkWithoutHeader = coreDarkContent.replace(/\/\*\*[\s\S]*?\*\/\s*\n\n/, '');
    await fs.writeFile(coreLightPath, coreLightContent.trim() + '\n\n' + coreDarkWithoutHeader.trim() + '\n');
    await fs.unlink(coreDarkPath);
  } catch (e) {
    console.warn('Could not combine core files:', e.message);
  }

  try {
    // Combine semantic files
    const semanticLightContent = await fs.readFile(semanticLightPath, 'utf-8');
    const semanticDarkContent = await fs.readFile(semanticDarkPath, 'utf-8');
    // Remove header from dark content and combine
    const semanticDarkWithoutHeader = semanticDarkContent.replace(/\/\*\*[\s\S]*?\*\/\s*\n\n/, '');
    await fs.writeFile(semanticLightPath, semanticLightContent.trim() + '\n\n' + semanticDarkWithoutHeader.trim() + '\n');
    await fs.unlink(semanticDarkPath);
  } catch (e) {
    console.warn('Could not combine semantic files:', e.message);
  }

  await componentSd.buildAllPlatforms();
  for (const themeSd of themeSds) {
    await themeSd.buildAllPlatforms();
  }
}

run();
