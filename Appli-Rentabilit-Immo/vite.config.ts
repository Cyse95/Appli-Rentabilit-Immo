import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Appli-Rentabilit-Immo/',
  plugins: [react()],
});
