"use server";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/shared/data/types";
import { createServerClient } from "@/shared/supabase/server";
import { adminUser, audit, UNAUTHORIZED } from "./lib";
import { PASSWORD_MAX, PASSWORD_MIN } from "./password";

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

/**
 * Lets the signed-in admin set their own password. The current password is checked first
 * (against a throwaway client, so the real session is untouched), then the cookie session
 * updates it. Error strings are codes the UI translates: "wrongCurrent", "tooShort",
 * "tooLong", "same", "mismatch"; anything else is a generic code ("failed") - raw Supabase text never reaches the client.
 */
export async function changePassword(current: string, next: string, confirm: string): Promise<ActionResult> {
  const user = await adminUser();
  if (!user?.email) return UNAUTHORIZED;
  if (typeof current !== "string" || typeof next !== "string" || typeof confirm !== "string") {
    return { success: false, error: "Invalid input" };
  }
  if (next.length < PASSWORD_MIN) return { success: false, error: "tooShort" };
  if (new TextEncoder().encode(next).length > PASSWORD_MAX) return { success: false, error: "tooLong" };
  if (next !== confirm) return { success: false, error: "mismatch" };
  if (next === current) return { success: false, error: "same" };

  try {
    const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: current });
    if (wrong) return { success: false, error: wrong.code === "invalid_credentials" ? "wrongCurrent" : "failed" };

    const { error } = await (await createServerClient()).auth.updateUser({ password: next });
    if (error) return { success: false, error: error.code === "same_password" ? "same" : "failed" };
    await audit(user, "account.password");
    // A leaked old session must die with the old password; this one stays signed in.
    try {
      await (await createServerClient()).auth.signOut({ scope: "others" });
    } catch (e) {
      console.error("[admin/auth] sign out other sessions:", e);
    }
    return { success: true };
  } catch (error) {
    console.error("[admin/auth] changePassword:", error);
    return { success: false, error: "Could not change the password" };
  }
}
