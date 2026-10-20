import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// cacheComponents is off on purpose: with it on, Next keeps up to 3 previous
// routes mounted-but-hidden via <Activity>, which would leave WebGL canvases and
// Lenis/rAF loops alive behind the visible page. Content pages use ISR (revalidate).
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "img.youtube.com", pathname: "/vi/**" },
    ],
  },
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

export default withNextIntl(nextConfig);
