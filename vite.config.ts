import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // Changed import to @vitejs/plugin-react
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react() // Removed jsxRuntime as it's automatic by default for this plugin
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // exclude: ['react-resizable-panels'], // Exclude from optimization - REMOVED
  },
}));