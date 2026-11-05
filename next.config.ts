import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// cacheComponents is off on purpose: with it on, Next keeps up to 3 previous
// routes mounted-but-hidden via <Activity>, which would leave WebGL canvases and
// Lenis/rAF loops alive behind the visible page. Content pages use ISR (revalidate).
const nextConfig: NextConfig = {
  experimental: {
    // A branded 404 for URLs that match no route at all (src/app/global-not-found.tsx).
    globalNotFound: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // 960/1280/1600 are the lantern-wall texture widths (see shared/lib/imageUrl.ts); 60 is its quality.
    deviceSizes: [640, 750, 828, 960, 1080, 1200, 1280, 1600, 1920, 2048, 3840],
    qualities: [60, 75],
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
