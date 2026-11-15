import { loadEnv, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL } = loadEnv(mode, process.cwd(), "VITE_");
  const apiTarget =
    VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:5000";

  return {
    plugins: [react()],
    assetsInclude: ["**/*.glb"],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
