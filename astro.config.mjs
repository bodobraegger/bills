import { defineConfig } from "astro/config";

// The top-level config isn't invoked per-command in Astro 7 (only nested
// options like `server` support that callback form), so branch on the
// standard Vite/Astro-set NODE_ENV instead: "development" for `astro dev`,
// "production" for `astro build`/`preview`. Dev serves at root for a normal
// localhost experience; the built site needs "/bills" to match the
// GitHub Pages project path.
const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  site: "https://bodobraegger.github.io",
  base: isDev ? "/" : "/bills",
  devToolbar: { enabled: false },
});
