"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE } from "../content/site";
import { useUI } from "../state/store";
import { navigateWithIris } from "../transition/navigate";
import { FishMark } from "./FishMark";

const CHILD_RIM = "oklch(0.7 0.1 210)";

/**
 * Click handler for internal links that should travel through the iris.
 * Leaves modified clicks (new tab, etc.) and same-page links to the browser.
 * Keyboard activation (detail 0) closes the iris on the link, not the corner.
 */
export function irisLinkClick(
  e: MouseEvent<HTMLElement>,
  href: string,
  currentPath: string | null,
  opts?: { rim?: string; waitForReady?: boolean },
) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (href === currentPath) return;
  e.preventDefault();
  const r = e.currentTarget.getBoundingClientRect();
  const origin = e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY };
  navigateWithIris(href, origin, opts);
}

const CSS = `
.lbf-nav{position:fixed;inset:0 0 auto 0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:1rem;
padding:clamp(.75rem,2vh,1.25rem) var(--gutter);pointer-events:none;
transition:opacity .45s var(--ease-out-quint),transform .45s var(--ease-out-quint)}
.lbf-nav::before{content:"";position:absolute;inset:0 0 -2.5rem 0;z-index:-1;pointer-events:none;
background:linear-gradient(to bottom,oklch(0.08 0.01 215/.72),oklch(0.08 0.01 215/0))}
.lbf-nav[data-hidden="true"]{opacity:0;transform:translateY(-10px);pointer-events:none}
.lbf-nav a{pointer-events:auto}
.lbf-nav-brand{display:inline-flex;align-items:center;gap:.6rem;color:var(--ink);text-decoration:none;padding:.25rem 0;
font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .5vw,1.5rem);line-height:1;letter-spacing:-.005em;white-space:nowrap}
.lbf-nav-list{display:flex;align-items:center;gap:clamp(.9rem,2.4vw,2.25rem);margin:0;padding:0;list-style:none}
.lbf-nav-link{position:relative;display:inline-block;padding:.5rem 0;color:var(--ink-dim);text-decoration:none;
font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1;white-space:nowrap;
text-shadow:0 0 14px oklch(0.08 0.01 215/.9);transition:color .12s linear}
.lbf-nav-link:hover,.lbf-nav-link[aria-current="page"]{color:var(--ink)}
.lbf-nav-link::after{content:"";position:absolute;left:0;right:0;bottom:.2rem;height:1px;background:var(--accent);
transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease-out-quint)}
.lbf-nav-link:hover::after,.lbf-nav-link:focus-visible::after,.lbf-nav-link[aria-current="page"]::after{transform:scaleX(1)}
.lbf-nav-link:active{transform:scale(.97)}
@media (max-width:30rem){
.lbf-nav-word{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.lbf-nav-list{gap:.85rem}
}
@media (prefers-reduced-motion:reduce){
.lbf-nav[data-hidden="true"]{transform:none}
.lbf-nav-link::after{transition:none}
}
`;

export function Nav() {
  const pathname = usePathname();
  const navHidden = useUI((s) => s.navHidden);
  // Only the series page hides the nav (until THE OTHERS); the flag must not leak to other routes.
  const hidden = navHidden && pathname?.startsWith("/projects/series") === true;

  const links: { label: string; href: string; current: boolean; iris?: { rim?: string; waitForReady?: boolean } }[] = [
    { label: "Work", href: "/projects", current: pathname === "/projects" },
    {
      label: SITE.seriesTitle,
      href: "/projects/series",
      current: pathname === "/projects/series",
      iris: { rim: CHILD_RIM, waitForReady: true },
    },
  ];

  // Dev tools (e.g. /dev/puppets) have their own chrome.
  if (pathname?.startsWith("/dev")) return null;

  return (
    <header className="lbf-nav" data-hidden={hidden ? "true" : "false"} inert={hidden}>
      <style>{CSS}</style>
      <Link
        href="/"
        className="lbf-nav-brand"
        aria-current={pathname === "/" ? "page" : undefined}
        aria-label={SITE.studio}
        onClick={(e) => irisLinkClick(e, "/", pathname)}
      >
        <FishMark size={16} animated />
        <span className="lbf-nav-word" aria-hidden="true">
          {SITE.studio}
        </span>
      </Link>
      <nav aria-label="Primary">
        <ul className="lbf-nav-list">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="lbf-nav-link"
                aria-current={l.current ? "page" : undefined}
                onClick={(e) => irisLinkClick(e, l.href, pathname, l.iris)}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a className="lbf-nav-link" href={`mailto:${SITE.email}`}>
              Contact
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
