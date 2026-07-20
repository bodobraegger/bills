import { defineConfig } from "astro/config";

// BASE_PATH comes from the deploy workflow (deploy.yml), itself read from
// actions/configure-pages' own base_path output rather than hardcoded here,
// so this stays correct if the repo is ever renamed or moved to a different
// GitHub Pages path. Local `astro dev`/`preview` don't set it, so they fall
// back to serving at root.
export default defineConfig({
  site: "https://bodobraegger.github.io",
  base: process.env.BASE_PATH || "/",
  devToolbar: { enabled: false },
});
