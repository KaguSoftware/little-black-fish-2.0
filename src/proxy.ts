import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);
const ADMIN_RE = /^\/(en|fa)\/admin(\/.*)?$/;

/**
 * 1. Refresh the Supabase session from the request cookies.
 * 2. Gate /{locale}/admin: no user or not role=admin → /{locale}/login.
 * 3. next-intl locale routing, carrying the refreshed Supabase cookies over.
 */
export default async function proxy(request: NextRequest) {
  const refreshed: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            refreshed.push({ name, value, options });
          });
        },
      },
    },
  );

  // Do not remove: refreshes an expired session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const withCookies = (res: NextResponse) => {
    refreshed.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  };

  const match = request.nextUrl.pathname.match(ADMIN_RE);
  if (match && (!user || user.app_metadata?.role !== "admin")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1]}/login`;
    url.search = "";
    return withCookies(NextResponse.redirect(url));
  }

  return withCookies(handleI18nRouting(request));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
