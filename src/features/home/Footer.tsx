"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SITE } from "@/shared/content/site";
import { useUI } from "@/shared/state/store";
import s from "./home.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;
const SWAP = {
  initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
  transition: { type: "spring", duration: 0.3, bounce: 0 },
} as const;

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const LINES = ["Little", "Black", "Fish"] as const;

export function Footer() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const reduced = useUI((st) => st.reducedMotion);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = useCallback(async () => {
    const ok = await copyText(SITE.email);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1900);
  }, []);

  return (
    <footer className={s.footer}>
      <h2 className={s.footName} aria-label={SITE.studio}>
        {LINES.map((l, i) => (
          <span key={l} className={s.footLine} aria-hidden>
            <motion.span
              className={s.footLineInner}
              initial={reduced ? { opacity: 0 } : { y: "55%", opacity: 0, filter: "blur(6px)" }}
              whileInView={reduced ? { opacity: 1 } : { y: "0%", opacity: 1, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.1, ease: EASE, delay: i * 0.12 }}
            >
              {l}
            </motion.span>
          </span>
        ))}
      </h2>

      <div className={s.footRow}>
        <div className={s.contact}>
          <p className={s.contactLead}>Say hello.</p>
          <button type="button" className={s.email} onClick={onCopy} aria-label={`Copy email address ${SITE.email}`}>
            <span className={s.emailText}>{SITE.email}</span>
            <span className={s.emailIcon} aria-hidden>
              <AnimatePresence mode="popLayout" initial={false}>
                {copied ? (
                  <motion.span key="check" className={s.iconSlot} {...SWAP}>
                    <CheckIcon />
                  </motion.span>
                ) : (
                  <motion.span key="copy" className={s.iconSlot} {...SWAP}>
                    <CopyIcon />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>
          <span className={s.copied} role="status" aria-live="polite">
            {copied ? "Copied" : ""}
          </span>
        </div>

        <ul className={s.socials}>
          {SITE.socials.map((so) => (
            <li key={so.label}>
              <a href={so.href} className={s.social} target="_blank" rel="noreferrer noopener">
                {so.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className={s.legal}>
        {SITE.studio}, {SITE.year}
      </p>
    </footer>
  );
}
