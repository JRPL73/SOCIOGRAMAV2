import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // ESTA LÍNEA ES LA CLAVE PARA LA PANTALLA BLANCA
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
