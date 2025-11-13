// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://aviaco.appbiz.fr',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [
      tailwindcss({
        // Configuration pour Tailwind v4
      })
    ]
  },
  output: 'server', // Mode server pour supporter les routes dynamiques et les API
  server: {
    port: 3001,
    host: true
  }
});
