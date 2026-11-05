import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/** Developer-only routes (puppet lab, review harness): they do not exist in production. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
