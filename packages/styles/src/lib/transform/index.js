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

// Custom format for component CSS variables with :host selector
StyleDictionary.registerFormat({
  name: 'css/variables-host',
  format: function({ dictionary, options }) {
    const prefix = options.prefix || 'pine';
    const selector = options.selector || ':host';
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

    let output = '/**\n * Do not edit directly, this file was auto-generated.\n */\n\n';
    output += `${selector} {\n`;

    allTokens.forEach(token => {
      const name = sanitizeName(token.path.join('-'));
      const value = formatTokenValue(token, prefix);
      output += `  --${prefix}-${name}: ${value};\n`;
    });

    output += '}\n';
    return output;
  }
});

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

        // Exclude dark tokens - check for dark in path
        const isDark = checkPath.includes('/dark.json') ||
                       checkPath.includes('/dark/') ||
                       checkPath.endsWith('dark.json') ||
                       checkPath.match(/\/dark(\.json)?$/i) ||
                       checkPath.match(/dark\.json/i);

        // If it's not dark, it's light (or neutral like brand tokens)
        return !isDark;
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

  // Base configuration for core files (now in brand/core.json, no dark mode variants)
  const coreConfigLight = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/brand/core.json`
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
            filter: token => token.filePath.includes('brand/core'),
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

  // Dark core config removed - core tokens no longer have dark mode variants
  // Only semantic tokens have dark mode variants now

  // Base configuration for semantic files with light and dark mode support
  // Include core files for reference resolution
  // Process light and dark separately to avoid token collisions
  const semanticConfigLight = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/brand/core.json`, // Core tokens for reference resolution
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
      `${basePath}/brand/core.json`, // Core tokens for reference resolution (no dark core tokens)
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
  // Note: core tokens no longer have dark mode variants
  const componentConfig = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/brand/core.json`, // Core tokens for reference resolution
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
  // Group themes by brand and combine light/dark into single files
  // kajabi_products-light + kajabi_products-dark → kajabi_products/kajabi_products.scss
  // pine-light + pine-dark → pine/pine.scss
  const brandGroups = {};
  Object.entries(themes).forEach(([theme, tokensets]) => {
    const themeParts = theme.toLowerCase().split('-');
    const brandName = themeParts[0];
    const modeName = themeParts.slice(1).join('-');

    if (!brandGroups[brandName]) {
      brandGroups[brandName] = {
        light: null,
        dark: null
      };
    }

    if (modeName === 'light') {
      brandGroups[brandName].light = tokensets;
    } else if (modeName === 'dark') {
      brandGroups[brandName].dark = tokensets;
    }
  });

  // Process each brand with light and dark separately, then combine
  const brandConfigs = [];
  Object.entries(brandGroups).forEach(([brandName, { light, dark }]) => {
    // Light mode config
    const lightSourceFiles = [];
    lightSourceFiles.push(`${basePath}/brand/core.json`); // Core tokens
    lightSourceFiles.push(`${basePath}/semantic/light.json`);

    if (light) {
      light.forEach(set => {
        if (set.includes(brandName) && !set.includes('core/') && !set.includes('semantic/')) {
          lightSourceFiles.push(`${basePath}/${set}.json`);
        }
        if (set.includes('components/') && set.includes('/light')) {
          lightSourceFiles.push(`${basePath}/${set}.json`);
        }
      });
    }

    // Dark mode config (include light for reference resolution)
    // Note: core tokens no longer have dark mode variants, only semantic tokens do
    const darkSourceFiles = [];
    darkSourceFiles.push(`${basePath}/brand/core.json`); // Core tokens for reference resolution
    darkSourceFiles.push(`${basePath}/semantic/light.json`);
    darkSourceFiles.push(`${basePath}/semantic/dark.json`);

    if (light) {
      light.forEach(set => {
        if (set.includes(brandName) && !set.includes('core/') && !set.includes('semantic/')) {
          darkSourceFiles.push(`${basePath}/${set}.json`);
        }
      });
    }

    if (dark) {
      dark.forEach(set => {
        if (set.includes('components/') && set.includes('/dark')) {
          darkSourceFiles.push(`${basePath}/${set}.json`);
        }
      });
    }

    const createConfig = (sourceFiles, mode, filterFn) => ({
      log: { verbosity: 'verbose' },
      source: sourceFiles,
      preprocessors: ['tokens-studio'],
      platforms: {
        css: {
          transformGroup: 'tokens-studio',
          transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
          buildPath: buildPath,
          files: [{
            destination: mode === 'light'
              ? `${brandName}/${brandName}.scss`
              : `${brandName}/${brandName}-dark.scss`,
            format: 'css/variables-with-dark-mode',
            filter: filterFn,
            options: {
              outputReferences: true,
              prefix: 'pine',
              mode: mode
            }
          }],
          prefix: 'pine'
        }
      }
    });

    // Light config
    brandConfigs.push(createConfig(
      lightSourceFiles,
      'light',
      (token) => {
        const filePath = token.filePath || '';

        // For both pine and kajabi_products brands, include ALL tokens (core, semantic, and components)
        // Include core tokens
        if (filePath.includes('brand/core')) return true;
        // Include semantic tokens
        if (filePath.includes('semantic/light')) return true;
        // Include brand-specific tokens
        if (filePath.includes(`${brandName}.json`)) return true;
        // Include component tokens
        if (filePath.includes('components/') && filePath.includes('/light')) return true;
        return false;
      }
    ));

    // Dark config
    brandConfigs.push(createConfig(
      darkSourceFiles,
      'dark',
      (token) => {
        const filePath = token.filePath || '';

        // For both pine and kajabi_products brands, include semantic and component dark tokens
        // Note: core tokens no longer have dark mode variants
        // Include semantic dark tokens
        if (filePath.includes('semantic/dark')) return true;
        // Include component dark tokens
        if (filePath.includes('components/') && filePath.includes('/dark')) return true;
        return false;
      }
    ));
  });

  const themeConfigs = brandConfigs;

  // Build core files (light only - no dark mode variants)
  const coreSdLight = new StyleDictionary(coreConfigLight);

  // Build semantic files (light and dark separately)
  const semanticSdLight = new StyleDictionary(semanticConfigLight);
  const semanticSdDark = new StyleDictionary(semanticConfigDark);

  // Build component files
  const componentSd = new StyleDictionary(componentConfig);

  // Build theme files
  const themeSds = themeConfigs.map(config => new StyleDictionary(config));

  // Register transform for all configurations
  const allSds = [coreSdLight, semanticSdLight, semanticSdDark, componentSd, ...themeSds];
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
  await semanticSdLight.buildAllPlatforms();
  await semanticSdDark.buildAllPlatforms();

  // Combine light and dark outputs for semantic files
  // Note: core files no longer have dark mode variants, so only semantic files are combined
  const semanticLightPath = resolve(buildPath, 'base/_semantic.scss');
  const semanticDarkPath = resolve(buildPath, 'base/_semantic-dark.scss');

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

  // Build theme files (light and dark separately)
  for (const themeSd of themeSds) {
    await themeSd.buildAllPlatforms();
  }

  // Combine light and dark brand files
  for (const brandName of ['kajabi_products', 'pine']) {
    const lightPath = resolve(buildPath, `${brandName}/${brandName}.scss`);
    const darkPath = resolve(buildPath, `${brandName}/${brandName}-dark.scss`);
    const finalPath = resolve(buildPath, `${brandName}/${brandName}.scss`);

    try {
      const lightContent = await fs.readFile(lightPath, 'utf-8');
      const darkContent = await fs.readFile(darkPath, 'utf-8');
      // Remove header from dark content and combine
      const darkWithoutHeader = darkContent.replace(/\/\*\*[\s\S]*?\*\/\s*\n\n/, '');
      await fs.writeFile(finalPath, lightContent.trim() + '\n\n' + darkWithoutHeader.trim() + '\n');
      await fs.unlink(darkPath);
    } catch (e) {
      console.warn(`Could not combine ${brandName} files:`, e.message);
    }
  }
}

run();
