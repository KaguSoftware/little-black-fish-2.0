import "server-only";

import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const ANON_TIMEOUT_MS = 4000;

/** Cookie-aware client: reads the logged-in admin's session. */
export async function createServerClient() {
  const store = await cookies();
  return createSSRClient(URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; the proxy refreshes them.
        }
      },
    },
  });
}

/** Public reads. A 4s timeout so a dead database falls back to the snapshot fast. */
export function createAnonClient() {
  return createClient(URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(ANON_TIMEOUT_MS) }),
    },
  });
}

/** Service role: bypasses RLS. Admin writes and contact inserts only. */
export function createServiceClient() {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** Call at the top of every admin mutation and the admin page. */
export async function requireAdminUser() {
  const {
    data: { user },
    error,
  } = await (await createServerClient()).auth.getUser();
  if (error || !user || user.app_metadata?.role !== "admin") throw new Error("Unauthorized");
  return user;
}
