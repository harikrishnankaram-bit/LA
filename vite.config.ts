import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const SUPABASE_URL = "https://dkkyxljjqloherpvvgvs.supabase.co";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxy ALL Supabase traffic through the Vite dev server (Node.js).
      // Node.js does NOT implement QUIC/HTTP3, so this forces TCP connections,
      // permanently fixing ERR_QUIC_PROTOCOL_ERROR in Chrome dev environment.
      "/supabase": {
        target: SUPABASE_URL,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/supabase/, ""),
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
