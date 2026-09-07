import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://gartha.me",
  output: "static",
  markdown: { shikiConfig: { theme: "github-dark" } },
  vite: { server: { proxy: { "/api": "http://localhost:8787" } } },
});
