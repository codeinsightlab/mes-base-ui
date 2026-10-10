import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  plugins: [vue()],
  resolve: { alias: [
    { find: '@', replacement: fileURLToPath(new URL('../../src', import.meta.url)) }
  ] },
  server: { host: '127.0.0.1', port: 18190, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] }},
  build: { outDir: '../../target/codegen-person-preview', emptyOutDir: true }
})
