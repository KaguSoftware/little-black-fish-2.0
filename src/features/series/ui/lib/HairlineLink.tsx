"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

/**
 * Redaction-style text link with an accent hairline that draws in from the left on
 * hover / focus. No filled pill. The resting hairline is a quiet ink hairline.
 */
export function HairlineLink({
  href,
  children,
  onClick,
  className = "",
  style,
  external,
}: {
  href: string;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  className?: string;
  style?: CSSProperties;
  external?: boolean;
}) {
  const ext = external ?? /^https?:\/\//.test(href);
  return (
    <a
      href={href}
      onClick={onClick}
      target={ext ? "_blank" : undefined}
      rel={ext ? "noopener noreferrer" : undefined}
      className={`group relative inline-block pb-[0.18em] ${className}`}
      style={style}
    >
      {children}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ background: "var(--hairline)" }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 rtl:origin-right transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
        style={{ background: "var(--accent)" }}
      />
    </a>
  );
}
