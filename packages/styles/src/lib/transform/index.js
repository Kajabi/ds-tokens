import { register, permutateThemes } from '@tokens-studio/sd-transforms';
import { generateCoreFiles, generateComponentFiles, generateComponentDarkFiles, generateSemanticFiles } from './generators/index.js';
import { readdirSync } from 'fs';
import StyleDictionary from 'style-dictionary';
import { getReferences, usesReferences, outputReferencesTransformed } from "style-dictionary/utils";
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { basePath } from './utils.js';

register(StyleDictionary, {
  /* options here if needed */
});

const buildPath = `_generated/`;

// Duration tokens collapse to 0ms under prefers-reduced-motion so components
// referencing var(--pine-motion-duration-*) inherit the override automatically.
const motionReducedBlock = `
@media (prefers-reduced-motion: reduce) {
  :root {
    --pine-motion-duration-fast: 0ms;
    --pine-motion-duration-base: 0ms;
    --pine-motion-duration-slow: 0ms;
  }
}`;

async function appendMotionReducedBlock(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  if (content.includes('--pine-motion-duration-fast') && !content.includes('prefers-reduced-motion')) {
    await fs.writeFile(filePath, content.trimEnd() + motionReducedBlock + '\n');
  }
}

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

    // Helper to convert a reference path to CSS variable name
    const refToVar = (refPath, prefix) => {
      const varName = sanitizeName(refPath.split('.').join('-'));
      return `var(--${prefix}-${varName})`;
    };

    // Helper to convert token references to CSS variable references
    const formatTokenValue = (token, prefix) => {
      const originalValue = token.original?.value || token.value;

      // Check if the original value is a simple string reference (starts with {)
      if (typeof originalValue === 'string' && originalValue.startsWith('{') && originalValue.endsWith('}')) {
        // Convert {color.purple.500} to var(--pine-color-purple-500)
        const refPath = originalValue.slice(1, -1); // Remove { and }
        return refToVar(refPath, prefix);
      }

      // Check if the original value contains a reference with operations (e.g., "{letter-spacing.114} * -1")
      if (typeof originalValue === 'string' && originalValue.includes('{') && originalValue.includes('}')) {
        // Extract the reference and any operations
        const refMatch = originalValue.match(/\{([^}]+)\}/);
        if (refMatch) {
          const refPath = refMatch[1];
          const varRef = refToVar(refPath, prefix);
          // Replace the reference in the original string with the CSS variable
          return originalValue.replace(/\{[^}]+\}/, varRef);
        }
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

    // Helper to convert a reference path to CSS variable name
    const refToVar = (refPath, prefix) => {
      const varName = sanitizeName(refPath.split('.').join('-'));
      return `var(--${prefix}-${varName})`;
    };

    // Helper to convert token references to CSS variable references
    const formatTokenValue = (token, prefix) => {
      const originalValue = token.original?.value || token.value;

      // Handle typography tokens (composite tokens with object values)
      if (token.type === 'typography' && typeof originalValue === 'object' && originalValue !== null) {
        // Build typography shorthand with CSS variable references
        const parts = [];

        // fontWeight
        if (originalValue.fontWeight) {
          const fwRef = originalValue.fontWeight.replace(/[{}]/g, '');
          parts.push(refToVar(fwRef, prefix));
        }

        // fontSize / lineHeight
        if (originalValue.fontSize && originalValue.lineHeight) {
          const fsRef = originalValue.fontSize.replace(/[{}]/g, '');
          const lhRef = originalValue.lineHeight.replace(/[{}]/g, '').replace(/\s*\*\s*100%/, '');
          parts.push(`${refToVar(fsRef, prefix)}/${refToVar(lhRef, prefix)}`);
        } else if (originalValue.fontSize) {
          const fsRef = originalValue.fontSize.replace(/[{}]/g, '');
          parts.push(refToVar(fsRef, prefix));
        }

        // fontFamily
        if (originalValue.fontFamily) {
          const ffRef = originalValue.fontFamily.replace(/[{}]/g, '');
          parts.push(refToVar(ffRef, prefix));
        }

        return parts.join(' ');
      }

      // Handle border tokens (composite tokens with object values)
      if (token.type === 'border' && typeof originalValue === 'object' && originalValue !== null) {
        const parts = [];

        if (originalValue.width) {
          const widthRef = originalValue.width.replace(/[{}]/g, '');
          parts.push(refToVar(widthRef, prefix));
        }

        if (originalValue.style) {
          parts.push(originalValue.style);
        }

        if (originalValue.color) {
          const colorRef = originalValue.color.replace(/[{}]/g, '');
          parts.push(refToVar(colorRef, prefix));
        }

        return parts.join(' ');
      }

      // Check if the original value is a simple string reference (starts with {)
      if (typeof originalValue === 'string' && originalValue.startsWith('{') && originalValue.endsWith('}')) {
        // Convert {color.purple.500} to var(--pine-color-purple-500)
        const refPath = originalValue.slice(1, -1); // Remove { and }
        return refToVar(refPath, prefix);
      }

      // Check if the original value contains a reference with operations (e.g., "{letter-spacing.114} * -1")
      if (typeof originalValue === 'string' && originalValue.includes('{') && originalValue.includes('}')) {
        // Extract the reference and any operations
        const refMatch = originalValue.match(/\{([^}]+)\}/);
        if (refMatch) {
          const refPath = refMatch[1];
          const varRef = refToVar(refPath, prefix);
          // Replace the reference in the original string with the CSS variable
          return originalValue.replace(/\{[^}]+\}/, varRef);
        }
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

  // Component-specific configuration — light mode only (dark files excluded to prevent collisions)
  const lightComponentFiles = readdirSync(`${basePath}/components`)
    .filter(f => f.endsWith('.json') && !f.includes('-dark'))
    .map(f => `${basePath}/components/${f}`);

  const componentConfig = {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/brand/core.json`,
      `${basePath}/semantic/light.json`,
      `${basePath}/semantic/dark.json`,
      ...lightComponentFiles,
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

  // Dark component configuration — processed separately to prevent token collisions
  const darkComponentFiles = readdirSync(`${basePath}/components`)
    .filter(f => f.includes('-dark.json'))
    .map(f => `${basePath}/components/${f}`);

  const componentDarkConfig = darkComponentFiles.length > 0 ? {
    log: {
      verbosity: 'verbose',
    },
    source: [
      `${basePath}/brand/core.json`,
      `${basePath}/semantic/light.json`,
      ...darkComponentFiles,
    ],
    preprocessors: ['tokens-studio'],
    platforms: {
      css: {
        transformGroup: 'tokens-studio',
        transforms: ['attribute/themeable', 'name/kebab', 'color/hex', 'ts/resolveMath', 'size/px'],
        buildPath: buildPath,
        files: [...generateComponentDarkFiles()],
        prefix: 'pine'
      },
    },
  } : null;

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
          // Only add light tokens to lightSourceFiles
          if (set.includes('/light') || !set.includes('/')) {
            lightSourceFiles.push(`${basePath}/${set}.json`);
          }
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

    // Note: We don't add brand-specific light tokens to dark source files anymore
    // since brand tokens are self-contained and dark tokens will be added below

    if (dark) {
      dark.forEach(set => {
        // Add brand-specific dark tokens (e.g., kajabi_products/dark)
        // Only add dark tokens, not light tokens
        if (set.includes(brandName) && !set.includes('core/') && !set.includes('semantic/') && set.includes('/dark')) {
          darkSourceFiles.push(`${basePath}/${set}.json`);
        }
        // Add component dark tokens
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

    // Light config — include full core + semantic + brand-specific tokens for all brands.
    // kajabi_products.css is the sole stylesheet loaded in the admin (no pine-core.css import),
    // so it must be self-contained: core palette + semantic layer + brand override + fonts.
    brandConfigs.push(createConfig(
      lightSourceFiles,
      'light',
      (token) => {
        const filePath = token.filePath || '';
        if (filePath.includes('brand/core')) return true;
        if (filePath.includes('semantic/light')) return true;
        if (filePath.includes(`${brandName}/light`)) return true;
        if (filePath.includes(`${brandName}.json`)) return true;
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
        if (filePath.includes('semantic/dark')) return true;
        if (filePath.includes(`${brandName}/dark`)) return true;
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
  const componentDarkSd = componentDarkConfig ? new StyleDictionary(componentDarkConfig) : null;

  // Build theme files
  const themeSds = themeConfigs.map(config => new StyleDictionary(config));

  // Register transform for all configurations
  const allSds = [coreSdLight, semanticSdLight, semanticSdDark, componentSd, ...(componentDarkSd ? [componentDarkSd] : []), ...themeSds];
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
  await appendMotionReducedBlock(resolve(buildPath, 'base/_core.scss'));
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

  if (componentDarkSd) {
    await componentDarkSd.buildAllPlatforms();

    // Combine light and dark component files
    const componentBuildDir = resolve(buildPath, 'pine/components');
    const componentFolders = await fs.readdir(componentBuildDir);
    for (const folder of componentFolders) {
      const lightPath = resolve(componentBuildDir, folder, `${folder}.tokens.scss`);
      const darkPath = resolve(componentBuildDir, folder, `${folder}.tokens-dark.scss`);
      try {
        const [lightContent, darkContent] = await Promise.all([
          fs.readFile(lightPath, 'utf-8'),
          fs.readFile(darkPath, 'utf-8'),
        ]);
        const darkWithoutHeader = darkContent.replace(/\/\*\*[\s\S]*?\*\/\s*\n\n/, '');
        await fs.writeFile(lightPath, lightContent.trim() + '\n\n' + darkWithoutHeader.trim() + '\n');
        await fs.unlink(darkPath);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }

  // Build theme files (light and dark separately)
  for (const themeSd of themeSds) {
    await themeSd.buildAllPlatforms();
  }

  // Font-face declarations — sourced from @pine-ds/core pine-core.css.
  // Included here so kajabi_products.css is the sole stylesheet loaded in the admin
  // (pine-core.css is not imported separately).
  const fontFaceBlock = `
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 100; src: local("Inter-Thin"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Thin.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 100; src: local("Inter-ThinItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-ThinItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 200; src: local("Inter-ExtraLight"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-ExtraLight.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 200; src: local("Inter-ExtraLightItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-ExtraLightItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 300; src: local("Inter-Light"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Light.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 300; src: local("Inter-LightItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-LightItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 400; src: local("Inter-Regular"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Regular.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 400; src: local("Inter-Italic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Italic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 500; src: local("Inter-Medium"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Medium.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 500; src: local("Inter-MediumItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-MediumItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 600; src: local("Inter-SemiBold"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-SemiBold.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 600; src: local("Inter-SemiBoldItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-SemiBoldItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 700; src: local("Inter-Bold"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Bold.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 700; src: local("Inter-BoldItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-BoldItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 800; src: local("Inter-ExtraBold"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-ExtraBold.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 800; src: local("Inter-ExtraBoldItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-ExtraBoldItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: normal; font-weight: 900; src: local("Inter-Black"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-Black.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Inter"; font-style: italic; font-weight: 900; src: local("Inter-BlackItalic"), url("https://sage.kajabi-cdn.com/fonts/inter/Inter-BlackItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: normal; font-weight: 200; src: local("FAIRE-Sprig-Thin"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-Thin.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: italic; font-weight: 200; src: local("FAIRE-Sprig-ThinItalic"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-ThinItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: normal; font-weight: 300; src: local("FAIRE-Sprig-Light"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-Light.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: italic; font-weight: 300; src: local("FAIRE-Sprig-LightItalic"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-LightItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: normal; font-weight: 400; src: local("FAIRE-Sprig-Regular"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-Regular.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: italic; font-weight: 400; src: local("FAIRE-Sprig-RegularItalic"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-RegularItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: normal; font-weight: 500; src: local("FAIRE-Sprig-Medium"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-Medium.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: italic; font-weight: 500; src: local("FAIRE-Sprig-MediumItalic"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-MediumItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: normal; font-weight: 700; src: local("FAIRE-Sprig-Bold"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-Bold.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: italic; font-weight: 700; src: local("FAIRE-Sprig-BoldItalic"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-BoldItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: normal; font-weight: 900; src: local("FAIRE-Sprig-Super"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-Super.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "FAIRE Sprig"; font-style: italic; font-weight: 900; src: local("FAIRE-Sprig-SuperItalic"), url("https://sage.kajabi-cdn.com/fonts/sprig/FAIRE-Sprig-SuperItalic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Noto Sans Arabic"; font-style: normal; font-weight: normal; src: local("Noto-Sans-Arabic"), url("https://sage.kajabi-cdn.com/fonts/noto/Noto-Sans-Arabic.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Noto Sans Hebrew"; font-style: normal; font-weight: normal; src: local("Noto-Sans-Hebrew"), url("https://sage.kajabi-cdn.com/fonts/noto/Noto-Sans-Hebrew.woff2?v=1") format("woff2"); }
@font-face { font-display: swap; font-family: "Noto Sans Devanagari"; font-style: normal; font-weight: normal; src: local("Noto-Sans-Devanagari"), url("https://sage.kajabi-cdn.com/fonts/noto/Noto-Sans-Devanagari.woff2?v=1") format("woff2"); }
`;

  // Site-brand theme override — member-facing pages opt in via data-theme="site".
  // Remaps accent/action tokens to defer to the site's brand color (--kj-brand-primary),
  // falling back to Kajabi purple when the brand variable is not set.
  // Admin pages never have this attribute → Kajabi purple unchanged.
  // Lives in kajabi_products.css (not pine-core.css) because it is Kajabi-specific.
  const siteBrandOverride = `
// Site-brand theme override — member-facing pages opt in via data-theme="site".
// Remaps accent/action tokens to defer to the site's brand color (--kj-brand-primary),
// falling back to Kajabi purple when the brand variable is not set.
// Admin pages never have this attribute → Kajabi purple unchanged.
[data-theme="site"] {
  --pine-color-accent:         var(--kj-brand-primary, var(--pine-color-purple-500));
  --pine-color-accent-disabled: var(--kj-brand-primary, var(--pine-color-purple-100));
  --pine-color-accent-hover:   var(--kj-brand-primary, var(--pine-color-purple-600));
  --pine-color-focus-ring:     var(--kj-brand-primary, var(--pine-color-purple-300));
}`;

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
      const combined = lightContent.trim() + '\n\n' + darkWithoutHeader.trim() + '\n';
      // kajabi_products.css is the sole stylesheet in the admin — prepend fonts and
      // append the site-brand override so it's fully self-contained.
      // Extract the auto-generated banner so it stays at line 1 after prepending fonts.
      const headerMatch = combined.match(/^\/\*\*[\s\S]*?\*\/\s*\n+/);
      const header = headerMatch ? headerMatch[0] : '';
      const body = combined.slice(header.length);
      const finalContent = brandName === 'kajabi_products'
        ? header + fontFaceBlock + body + siteBrandOverride + '\n'
        : combined;
      await fs.writeFile(finalPath, finalContent);
      await appendMotionReducedBlock(finalPath);
      await fs.unlink(darkPath);
    } catch (e) {
      console.warn(`Could not combine ${brandName} files:`, e.message);
    }
  }
}

run();
