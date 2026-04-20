import { defineConfig } from 'vite';

export default defineConfig({
    clearScreen: false,
    server: {
        port: 3000,
        open: true
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true
    }
});
