import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The published `zmachine` package uses extensionless ESM subpath imports
    // that Node/Vitest cannot resolve. Point at the prebundled ESM build.
    alias: {
      zmachine: path.resolve(
        root,
        'node_modules/zmachine/dist/zmachine.esm.min.js',
      ),
    },
  },
  optimizeDeps: {
    include: ['zmachine'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
