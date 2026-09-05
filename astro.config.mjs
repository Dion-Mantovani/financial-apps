import { defineConfig } from 'astro/config';
import alpinejs from '@astrojs/alpinejs';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  integrations: [alpinejs()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: vercel(),
});