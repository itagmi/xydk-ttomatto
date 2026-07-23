import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * /auth/*, _next, 정적 파일(manifest, 아이콘 등)은 제외하고 나머지 모두 보호
     * 정적 파일이 로그인 리다이렉트에 걸리면 PWA 아이콘이 안 뜬다
     */
    "/((?!auth|_next/static|_next/image|favicon.ico|manifest.json|apple-touch-icon.png|icon-192.png|icon-512.png|icon.svg|tomato.gif).*)",
  ],
};
