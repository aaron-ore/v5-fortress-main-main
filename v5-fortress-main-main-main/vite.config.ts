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
      // Removed external: ['react-resizable-panels'],
    },
  },
  optimizeDeps: {
    // Removed include: ['react-resizable-panels'],
    // Removed exclude: ['react-resizable-panels'],
  },
}));