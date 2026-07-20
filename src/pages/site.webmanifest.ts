import type { APIRoute } from "astro";

// A generated endpoint rather than a static public/ file so its icon paths
// can go through the same import.meta.env.BASE_URL as everything else in
// index.astro, instead of duplicating the deploy's base path here too.
export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL;
  const manifest = {
    name: "Offerten & Rechnungen",
    short_name: "Bills",
    icons: [
      { src: `${base}android-chrome-192x192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}android-chrome-512x512.png`, sizes: "512x512", type: "image/png" },
    ],
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone",
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
};
