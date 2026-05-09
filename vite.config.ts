import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        badminton: resolve(__dirname, 'badminton/index.html'),
        blog: resolve(__dirname, 'blog/index.html'),
        badmintoncost: resolve(__dirname, 'badmintoncost/index.html'),
      },
    },
  },
})
