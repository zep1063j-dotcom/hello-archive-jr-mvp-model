import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

// 보호 라우트의 "낙관적" 차단 + 세션 쿠키 갱신.
// 여기서는 토큰 서명만 빠르게 확인한다. 최종 권한 검증은 서버 코드의 requireUser()(getUser)와 RLS가 한다.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // 인증 쿠키가 담긴 응답이 CDN에 캐시되지 않도록 라이브러리가 주는 헤더를 그대로 붙인다.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  // 갱신된 세션 쿠키를 리다이렉트 응답에도 옮겨 담는다.
  const redirectTo = (target: URL) => {
    const redirectResponse = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (key === "cache-control" || key === "pragma" || key === "expires") {
        redirectResponse.headers.set(key, value);
      }
    });
    return redirectResponse;
  };

  if (pathname === "/login") {
    return isSignedIn ? redirectTo(new URL("/home", request.url)) : response;
  }

  if (!isSignedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/login", "/onboarding", "/home", "/write", "/archive/:path*", "/profile", "/yearly", "/make"],
};
