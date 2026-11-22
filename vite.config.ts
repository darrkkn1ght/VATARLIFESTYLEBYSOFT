import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 25,
            },
            {
              name: 'vendor-motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
    strictPort: false,
  },
});
