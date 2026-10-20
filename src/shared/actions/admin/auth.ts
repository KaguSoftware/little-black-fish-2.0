"use server";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createServerClient } from "@/shared/supabase/server";

/**
 * Ends the session and sends the visitor to /{locale}/login. No admin check: signing out is
 * harmless for anyone, and a half-expired session must still be able to leave.
 */
export async function signOut(locale: string): Promise<never> {
  const target = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  try {
    await (await createServerClient()).auth.signOut();
  } catch (error) {
    console.error("[admin/auth] signOut:", error);
  }
  // Outside the try: redirect() throws by design.
  return redirect({ href: "/login", locale: target });
}
