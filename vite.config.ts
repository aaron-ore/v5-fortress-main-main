import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development, production, etc.)
  // The third parameter '' loads all env vars, regardless of VITE_ prefix
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
    define: { // Explicitly define environment variables to ensure they are injected into the client-side bundle
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'import.meta.env.VITE_SHOPIFY_CLIENT_ID': JSON.stringify(env.VITE_SHOPIFY_CLIENT_ID),
      'import.meta.env.VITE_SHOPIFY_CLIENT_SECRET': JSON.stringify(env.VITE_SHOPIFY_CLIENT_SECRET),
      // Add any other VITE_ prefixed env vars you need to expose to the client here
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
  };
});