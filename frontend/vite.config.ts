import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import os from "node:os";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Avoid OneDrive/antivirus locks on node_modules/.vite (common 504 Outdated Optimize Dep cause).
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
        "./src/pages/DashboardPage.tsx",
      ],
    },
  },
  optimizeDeps: {
    // Pre-bundle so first lazy/dynamic HeartScene load does not trigger a mid-request re-optimize (504).
    include: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "three-stdlib",
      "zustand",
      "@tanstack/react-query",
      "recharts",
      "react-router-dom",
    ],
  },
});
