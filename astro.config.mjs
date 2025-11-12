// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://shop.aviaco.fr',
  vite: {
    plugins: [
      tailwindcss({
        // Configuration pour Tailwind v4
      })
    ]
  },
  output: 'server', // Mode server pour supporter les routes dynamiques et les API
  server: {
    port: 3000,
    host: true
  }
});

