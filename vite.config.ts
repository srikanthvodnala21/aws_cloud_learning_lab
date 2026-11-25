import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site from https://USERNAME.github.io/REPOSITORY-NAME/
// The deploy workflow sets BASE_PATH=/REPOSITORY-NAME/ so every asset URL is
// emitted with the repository sub-path. Locally we fall back to a relative
// base ('./'), which also works when opening the built site from any folder.
const base = process.env.BASE_PATH || './';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
