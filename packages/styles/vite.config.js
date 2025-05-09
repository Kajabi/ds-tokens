import { defineConfig } from 'vite';
import { glob } from 'glob';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        glob.sync('_generated/**/*.scss').map(file => [
          // Keep the original file path as the key
          file,
          // Create full path to file
          resolve(__dirname, file)
        ])
      ),
      output: {
        assetFileNames: ({ name }) => {
          // Extract the relevant part of the path and transform it
          const path = name
            .replace('_generated/', '')
          return path;
        }
      }
    }
  }
});
