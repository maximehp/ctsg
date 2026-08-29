import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: "github-pages",
  publicDir: "../public",
  base: "/ctsg/",
  plugins: [react()],
  build: {
    outDir: `${projectRoot}pages-dist`,
    emptyOutDir: true,
  },
});
