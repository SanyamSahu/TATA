import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^es-toolkit\/compat\/(.*)$/,
        replacement: path.resolve(__dirname, 'node_modules/es-toolkit/compat') + '/$1.mjs'
      },
      {
        find: 'tinyglobby',
        replacement: path.resolve(__dirname, 'node_modules/tinyglobby/dist/index.cjs')
      }
    ]
  },
})
