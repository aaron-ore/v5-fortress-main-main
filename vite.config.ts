import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: ['react-resizable-panels'],
    },
  },
  optimizeDeps: {
    // exclude: ['react-resizable-panels'], // Exclude from optimization - REMOVED
  },
}));