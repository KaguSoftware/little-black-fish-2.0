import type { NextConfig } from "next";

// cacheComponents is off on purpose: with it on, Next keeps up to 3 previous
// routes mounted-but-hidden via <Activity>, which would leave WebGL canvases and
// Lenis/rAF loops alive behind the visible page. This site is fully static.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        // CSS Modules must keep their module semantics: only plain .css goes through Tailwind.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
