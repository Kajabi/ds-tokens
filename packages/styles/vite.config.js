import { defineConfig } from 'vite';
import { glob } from 'glob';
import { resolve } from 'path';

// Custom plugin to track which entry each CSS asset comes from
const scssEntryPlugin = () => {
  const entryToCssMap = new Map();

  return {
    name: 'scss-entry-naming',
    buildStart() {
      // Track all SCSS entries
      const scssFiles = glob.sync('_generated/**/*.scss');
      scssFiles.forEach(file => {
        const entryKey = file.replace('_generated/', '').replace(/\.scss$/, '');
        const fullPath = resolve(__dirname, file);
        entryToCssMap.set(fullPath, entryKey);
      });
    },
    renderChunk(_code, chunk) {
      // Track which CSS files are associated with which entries
      if (chunk.facadeModuleId) {
        const entryKey = entryToCssMap.get(chunk.facadeModuleId);
        if (entryKey) {
          // Store mapping for later use in generateBundle
          chunk.entryKey = entryKey;
        }
      }
    },
    generateBundle(options, bundle) {
      // Build entry map from SCSS files (same as buildStart)
      const entryKeyMap = new Map();
      glob.sync('_generated/**/*.scss').forEach(file => {
        const entryKey = file.replace('_generated/', '').replace(/\.scss$/, '');
        const fullPath = resolve(__dirname, file);
        entryKeyMap.set(fullPath, entryKey);
        entryKeyMap.set(fullPath.replace(/\\/g, '/'), entryKey);
        // Also map by basename for pattern matching
        const basename = file.split('/').pop().replace('.scss', '');
        entryKeyMap.set(basename, entryKey);
      });

      // Track which chunks belong to which entries
      const chunkToEntry = new Map();
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.facadeModuleId) {
          const normalizedFacade = chunk.facadeModuleId.replace(/\\/g, '/');
          // Try to match facade module ID to entry
          for (const [entryPath, entryKey] of entryKeyMap.entries()) {
            if (normalizedFacade.includes(entryPath) || entryPath.includes(normalizedFacade)) {
              chunkToEntry.set(fileName, entryKey);
              break;
            }
          }
        }
      }

      // Process CSS assets - match them to entries via chunks
      const cssAssets = Object.entries(bundle).filter(([name, asset]) =>
        asset.type === 'asset' && name.endsWith('.css')
      );

      // Match CSS assets to entries
      for (const [fileName, asset] of cssAssets) {
        let matchedEntry = null;

        // Method 1: Check chunk CSS references
        for (const [chunkName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk') {
            const entryKey = chunkToEntry.get(chunkName);
            if (entryKey) {
              const chunkCss = Array.isArray(chunk.viteMetadata?.importedCss)
                ? chunk.viteMetadata.importedCss
                : [];
              if (chunkCss.includes(fileName)) {
                matchedEntry = entryKey;
                break;
              }
            }
          }
        }

        // Method 2: Pattern matching
        if (!matchedEntry) {
          for (const entryKey of entryKeyMap.values()) {
            const entryBasename = entryKey.split('/').pop();
            if (fileName.includes(entryBasename)) {
              matchedEntry = entryKey;
              break;
            }
          }
        }

        // Rename if matched
        if (matchedEntry && fileName !== `${matchedEntry}.css`) {
          delete bundle[fileName];
          bundle[`${matchedEntry}.css`] = {
            ...asset,
            fileName: `${matchedEntry}.css`
          };
        }
      }

    }
  };
};

export default defineConfig({
  plugins: [scssEntryPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: true, // Split CSS per entry
    rollupOptions: {
      input: Object.fromEntries(
        glob.sync('_generated/**/*.scss').map(file => {
          // Create a unique entry key based on the file path
          const entryKey = file.replace('_generated/', '').replace(/\.scss$/, '');
          return [
            entryKey, // Use clean path as key (e.g., 'kajabi_products/kajabi_products-light')
            resolve(__dirname, file) // Full path to file
          ];
        })
      ),
      output: {
        // For JS chunks (minimal, just to trigger CSS processing)
        entryFileNames: () => 'assets/[name].js',
        chunkFileNames: () => 'assets/[name].js',
        // For CSS assets - use entry name directly
        assetFileNames: (assetInfo) => {
          if (assetInfo.type === 'asset' && assetInfo.name && assetInfo.name.endsWith('.css')) {
            // Get all entries
            const scssFiles = glob.sync('_generated/**/*.scss');
            const entryMap = new Map();
            scssFiles.forEach(file => {
              const entryKey = file.replace('_generated/', '').replace(/\.scss$/, '');
              const fullPath = resolve(__dirname, file);
              entryMap.set(fullPath, entryKey);
              entryMap.set(fullPath.replace(/\\/g, '/'), entryKey);
            });

            // Try to match asset to entry using names array
            if (assetInfo.names && assetInfo.names.length > 0) {
              for (const name of assetInfo.names) {
                const normalized = name.replace(/\\/g, '/');
                for (const [entryPath, entryKey] of entryMap.entries()) {
                  if (normalized.includes(entryPath) || entryPath.includes(normalized)) {
                    return `${entryKey}.css`;
                  }
                }
              }
            }
          }
          return 'assets/[name].[ext]';
        }
      }
    }
  }
});
