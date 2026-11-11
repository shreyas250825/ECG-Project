import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import os from "node:os";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: path.join(os.tmpdir(), "ecg-web-vite-cache"),
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/ws": { target: "ws://127.0.0.1:8000", ws: true },
    },
    warmup: {
      clientFiles: [
        "./src/components/heart3d/HeartScene.tsx",
        "./src/components/heart3d/HeartModel.tsx",
        "./src/components/heart3d/RealisticHeart.tsx",
        "./src/pages/OverviewPage.tsx",
      ],
    },
  },
  build: {
    // Increase warning threshold to suppress pre-existing Three.js warning
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Three.js ecosystem — isolated chunk (~1.4MB gzip ~380KB)
          if (
            id.includes("node_modules/three") ||
            id.includes("node_modules/@react-three") ||
            id.includes("node_modules/three-stdlib") ||
            id.includes("node_modules/three-mesh-bvh")
          ) {
            return "vendor-three";
          }
          // Recharts + d3 utilities
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-vendor")
          ) {
            return "vendor-charts";
          }
          // Supabase client
          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase";
          }
          // React ecosystem
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@tanstack")
          ) {
            return "vendor-react";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "three-stdlib",
      "zustand",
      "@tanstack/react-query",
      "recharts",
      "react-router-dom",
      "@supabase/supabase-js",
    ],
  },
});
