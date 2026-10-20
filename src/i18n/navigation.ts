import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware drop-ins for next/link and next/navigation: hrefs stay unprefixed ("/projects"). */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(routing);
