import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/glitch/',
  plugins: [svelte()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
  },
});
