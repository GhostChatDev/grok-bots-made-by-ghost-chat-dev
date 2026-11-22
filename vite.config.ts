import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // relative asset paths so the build also works under a GitHub Pages sub-folder
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
});
