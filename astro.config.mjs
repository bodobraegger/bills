import { defineConfig } from "astro/config";

// BASE_PATH comes from the deploy workflow (deploy.yml), itself read from
// actions/configure-pages' own base_path output rather than hardcoded here,
// so this stays correct if the repo is ever renamed or moved to a different
// GitHub Pages path. Local `astro dev`/`preview` don't set it, so they fall
// back to serving at root. configure-pages' base_path comes back without a
// trailing slash (e.g. "/bills"), but import.meta.env.BASE_URL needs one so
// that `${BASE_URL}favicon.ico`-style concatenation doesn't glue the base
// path and filename together.
const rawBase = process.env.BASE_PATH || "/";
const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export default defineConfig({
  site: "https://bodobraegger.github.io",
  base,
  devToolbar: { enabled: false },
});
