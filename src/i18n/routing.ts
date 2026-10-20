import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fa"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];

/** Message namespaces; each lives in messages/<locale>/<namespace>.json. */
export const NAMESPACES = [
  "common",
  "nav",
  "home",
  "archive",
  "project",
  "category",
  "series",
  "about",
  "support",
  "contact",
  "login",
  "admin",
  "footer",
] as const;
