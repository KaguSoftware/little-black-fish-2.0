"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { navigateWithIris } from "../transition/navigate";
import { useUI } from "../state/store";
import { FishMark } from "./FishMark";

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

/** Below this width the links live in the menu. Keep in sync with MENU_MQ. */
const MENU_MQ = "(max-width: 40rem)";

const CSS = `
.lbf-nav{position:fixed;inset:0 0 auto 0;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:1rem;
padding:clamp(.75rem,2vh,1.25rem) var(--gutter);pointer-events:none}
.lbf-nav::before{content:"";position:absolute;inset:0 0 -2.5rem 0;z-index:-1;pointer-events:none;
background:linear-gradient(to bottom,oklch(0.08 0.01 215/.72),oklch(0.08 0.01 215/0))}
.lbf-nav a,.lbf-nav button{pointer-events:auto}
.lbf-nav-brand{display:inline-flex;align-items:center;gap:.6rem;color:var(--ink);text-decoration:none;padding:.25rem 0;
font-family:var(--font-display);font-size:clamp(1.15rem,1rem + .5vw,1.5rem);line-height:1;letter-spacing:-.005em;white-space:nowrap}
.lbf-nav-list{display:flex;align-items:center;gap:clamp(.9rem,2.4vw,2.25rem);margin:0;padding:0;list-style:none}
.lbf-nav-link{position:relative;display:inline-block;padding:.5rem 0;color:var(--ink-dim);text-decoration:none;
font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1;white-space:nowrap;
text-shadow:0 0 14px oklch(0.08 0.01 215/.9);transition:color .12s linear}
.lbf-nav-link:hover,.lbf-nav-link[aria-current="page"]{color:var(--ink)}
.lbf-nav-link::after{content:"";position:absolute;left:0;right:0;bottom:.2rem;height:1px;background:var(--accent);
transform:scaleX(0);transform-origin:left;transition:transform .35s var(--ease-out-quint)}
[dir="rtl"] .lbf-nav-link::after{transform-origin:right}
.lbf-nav-link:hover::after,.lbf-nav-link:focus-visible::after,.lbf-nav-link[aria-current="page"]::after{transform:scaleX(1)}
.lbf-nav-link:active{transform:scale(.97)}

/* Menu button: only on phones */
.lbf-nav-menu{display:none;align-items:center;gap:.7rem;min-height:2.75rem;padding:0 .15rem;border:0;background:none;cursor:pointer;
color:var(--ink);font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1;text-shadow:0 0 14px oklch(0.08 0.01 215/.9);
-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.lbf-nav-menu:active{transform:scale(.97)}
.lbf-bars{display:grid;gap:5px;width:1.6rem}
.lbf-bars i{display:block;height:1.5px;background:currentColor;transform-origin:center;transition:transform .3s var(--ease-out-quint)}
.lbf-bars i:last-child{width:70%;justify-self:end}
.lbf-nav-menu:hover .lbf-bars i:last-child,.lbf-nav-menu:focus-visible .lbf-bars i:last-child{width:100%}

/* Full-screen menu */
.lbf-menu{box-sizing:border-box;width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;padding:0;border:0;color:var(--ink);
background:oklch(0.065 0.008 215);overflow:hidden}
.lbf-menu[open]{display:flex;flex-direction:column;animation:lbf-menu-in .28s var(--ease-out-quint) both}
.lbf-menu::backdrop{background:oklch(0.04 0.006 215/.8)}
.lbf-menu-bar{display:flex;align-items:center;justify-content:space-between;flex:none;
padding:clamp(.75rem,2vh,1.25rem) var(--gutter)}
.lbf-menu-close{display:inline-flex;align-items:center;gap:.7rem;min-height:2.75rem;padding:0 .15rem;border:0;background:none;cursor:pointer;
color:var(--ink);font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.lbf-x{position:relative;display:block;width:1.6rem;height:1.6rem}
.lbf-x i{position:absolute;left:0;right:0;top:50%;height:1.5px;background:currentColor}
.lbf-x i:first-child{transform:rotate(45deg)}
.lbf-x i:last-child{transform:rotate(-45deg)}
.lbf-menu-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:grid;align-content:center;gap:.25rem;
margin:0;padding:1rem var(--gutter);list-style:none}
.lbf-menu-link{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;min-height:3.5rem;padding:.35rem 0;color:var(--ink-dim);
text-decoration:none;font-family:var(--font-display);font-size:clamp(2.4rem,12vw,4.2rem);line-height:1.05;letter-spacing:-.01em;
box-shadow:inset 0 -1px 0 var(--hairline);transition:color .12s linear;-webkit-tap-highlight-color:transparent}
.lbf-menu-link:hover,.lbf-menu-link:focus-visible,.lbf-menu-link[aria-current="page"]{color:var(--ink)}
.lbf-menu-link[aria-current="page"]::after{content:"";flex:none;align-self:center;width:.55rem;height:.55rem;border-radius:50%;background:var(--accent)}
.lbf-menu-link:active{color:var(--accent)}
.lbf-menu-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:1rem;
padding:1rem var(--gutter) calc(1.25rem + env(safe-area-inset-bottom,0px))}
.lbf-menu-lang{display:inline-flex;align-items:center;min-height:2.75rem;color:var(--ink);text-decoration:none;
font-family:var(--font-sans);font-weight:500;font-size:var(--step-0)}
.lbf-menu-list li{animation:lbf-menu-item .5s var(--ease-out-quint) both;animation-delay:calc(60ms + var(--i,0) * 55ms)}
html:has(dialog.lbf-menu[open]){overflow:hidden;scrollbar-gutter:stable}
@keyframes lbf-menu-in{from{opacity:0}to{opacity:1}}
@keyframes lbf-menu-item{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

.lbf-menu-motion{display:inline-flex;align-items:center;min-height:2.75rem;padding:0 .15rem;border:0;background:none;cursor:pointer;color:var(--ink-dim);
font-family:var(--font-sans);font-weight:500;font-size:var(--step-0);-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:color .12s linear}
.lbf-menu-motion:hover,.lbf-menu-motion:focus-visible{color:var(--ink)}
.lbf-menu-motion:active{transform:scale(.97)}

@media (max-width:40rem){
.lbf-nav-desktop{display:none}
.lbf-nav-menu{display:inline-flex}
/* A solid-enough bar so the logo and Menu never fight the page behind them. */
.lbf-nav::before{inset:0;background:linear-gradient(to bottom,oklch(0.08 0.01 215/.94),oklch(0.08 0.01 215/.82));
-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);box-shadow:0 1px 0 var(--hairline)}
.lbf-nav-menu{text-shadow:none}
}
@media (max-width:30rem){
.lbf-nav-word{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
}
@media (prefers-reduced-motion:reduce){
.lbf-nav-link::after,.lbf-bars i{transition:none}
.lbf-menu[open],.lbf-menu-list li{animation:none}
}
`;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const paused = useUI((st) => st.paused);
  const togglePaused = useUI((st) => st.togglePaused);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  // Navigating (iris or not) closes the menu: reset during render when the page or language changes.
  const pageKey = `${pathname}|${locale}`;
  const [seenPage, setSeenPage] = useState(pageKey);
  if (seenPage !== pageKey) {
    setSeenPage(pageKey);
    setOpen(false);
  }

  const links: { label: string; href: string; current: boolean; iris?: { rim?: string; waitForReady?: boolean } }[] = [
    { label: t("work"), href: "/projects", current: pathname === "/projects" },
    { label: t("about"), href: "/about", current: pathname === "/about" },
    { label: t("support"), href: "/support", current: pathname === "/support" },
    { label: t("contact"), href: "/contact", current: pathname === "/contact" },
  ];

  const otherLocale: Locale = locale === "fa" ? "en" : "fa";

  // The native dialog is the source of truth for focus trapping and Esc; state mirrors it.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Growing past the phone breakpoint closes the menu.
  useEffect(() => {
    const mq = window.matchMedia(MENU_MQ);
    const onChange = () => {
      if (!mq.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Dev tools (e.g. /dev/puppets) have their own chrome.
  if (pathname?.startsWith("/dev")) return null;

  const switchLocale = (e: MouseEvent<HTMLElement>) => {
    // Keep the query string (e.g. archive filters) when switching language.
    const search = window.location.search;
    if (!search || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(`${pathname || "/"}${search}`, { locale: otherLocale });
  };

  /** Name the language in itself, so a screen reader voices it in that language. */
  const langName = (
    <span lang={t("switchLang")}>
      <span aria-hidden="true">{t("switchLabel")}</span>
      <span className="sr-only">{t("switchName")}</span>
    </span>
  );

  return (
    <header className="lbf-nav">
      <style>{CSS}</style>
      <Link
        href="/"
        className="lbf-nav-brand"
        aria-current={pathname === "/" ? "page" : undefined}
        aria-label={tc("studio")}
        onClick={(e) => irisLinkClick(e, "/", pathname)}
      >
        <FishMark size={16} animated />
        <span className="lbf-nav-word" aria-hidden="true">
          {tc("studio")}
        </span>
      </Link>

      <nav className="lbf-nav-desktop" aria-label={t("primary")}>
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
            <Link href={pathname || "/"} locale={otherLocale} hrefLang={otherLocale} className="lbf-nav-link" onClick={switchLocale}>
              {langName}
            </Link>
          </li>
        </ul>
      </nav>

      <button
        type="button"
        className="lbf-nav-menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="lbf-menu"
        onClick={() => setOpen(true)}
      >
        <span>{t("menu")}</span>
        <span className="lbf-bars" aria-hidden="true">
          <i />
          <i />
        </span>
      </button>

      <dialog
        ref={dialog}
        id="lbf-menu"
        className="lbf-menu"
        aria-label={t("menu")}
        data-lenis-prevent
        onClose={() => setOpen(false)}
      >
        <div className="lbf-menu-bar">
          <Link
            href="/"
            className="lbf-nav-brand"
            aria-label={tc("studio")}
            aria-current={pathname === "/" ? "page" : undefined}
            onClick={(e) => irisLinkClick(e, "/", pathname)}
          >
            <FishMark size={16} animated />
          </Link>
          <button type="button" className="lbf-menu-close" autoFocus onClick={() => setOpen(false)}>
            <span>{t("close")}</span>
            <span className="lbf-x" aria-hidden="true">
              <i />
              <i />
            </span>
          </button>
        </div>
        <nav aria-label={t("primary")} style={{ display: "contents" }}>
          <ul className="lbf-menu-list">
            {links.map((l, i) => (
              <li key={l.href} style={{ ["--i" as string]: i }}>
                <Link
                  href={l.href}
                  className="lbf-menu-link"
                  aria-current={l.current ? "page" : undefined}
                  onClick={(e) => {
                    // The iris takes over for a real navigation; on the current page just close.
                    if (l.current) setOpen(false);
                    irisLinkClick(e, l.href, pathname, l.iris);
                  }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lbf-menu-foot">
          <Link
            href={pathname || "/"}
            locale={otherLocale}
            hrefLang={otherLocale}
            className="lbf-menu-lang"
            onClick={switchLocale}
          >
            {langName}
          </Link>
          <button type="button" className="lbf-menu-motion" onClick={togglePaused}>
            {paused ? tc("playMotion") : tc("pauseMotion")}
          </button>
        </div>
      </dialog>
    </header>
  );
}
