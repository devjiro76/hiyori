import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tauri expects a fixed port during dev
const TAURI_DEV_HOST = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Prevent vite from obscuring Rust errors
  clearScreen: false,
  server: {
    // Tauri expects a fixed port; fail if not available
    strictPort: true,
    host: TAURI_DEV_HOST || false,
    port: 1420,
  },
  // Env variables prefixed with TAURI_ are available in frontend
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Tauri uses Chromium on Windows/Linux and WebKit on macOS
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari14',
    // Produce sourcemaps for Tauri debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
