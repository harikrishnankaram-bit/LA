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
        configure: (proxy) => {
          // When the proxy cannot reach Supabase (ETIMEDOUT, ECONNREFUSED, etc.),
          // return a proper JSON error instead of an empty 500 body.
          // This prevents "Unexpected end of JSON input" in the Supabase SDK.
          proxy.on("error", (err, _req, res) => {
            console.error("[Supabase Proxy Error]", err.message);
            if (res && !res.headersSent) {
              (res as any).writeHead(503, { "Content-Type": "application/json" });
              (res as any).end(
                JSON.stringify({
                  error: "service_unavailable",
                  message:
                    "Cannot reach Supabase. The project may be paused. Visit supabase.com/dashboard to resume it.",
                  code: err.message,
                })
              );
            }
          });
        },
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
