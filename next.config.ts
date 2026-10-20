import type { NextConfig } from "next";

// cacheComponents is off on purpose: with it on, Next keeps up to 3 previous
// routes mounted-but-hidden via <Activity>, which would leave WebGL canvases and
// Lenis/rAF loops alive behind the visible page. This site is fully static.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
