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
      external: ['react-resizable-panels'], // Mark as external for Rollup
    },
  },
  optimizeDeps: {
    include: ['react-resizable-panels'], // Explicitly include for Vite's optimization
  },
}));