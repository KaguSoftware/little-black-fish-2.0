"use client";

import type { ComponentProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { irisLinkClick } from "@/shared/ui/Nav";

/** Locale-aware Link that travels through the iris (same behaviour as the Nav). `href` stays unprefixed. */
export function IrisLink({ href, onClick, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        irisLinkClick(e, href, pathname);
      }}
      {...rest}
    />
  );
}
