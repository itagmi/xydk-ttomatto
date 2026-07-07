import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = "https://ttomatto.vercel.app";
const REDIRECT_URI = `${APP_URL}/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${APP_URL}/auth/login`);
  }

  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", process.env.THREADS_APP_ID!);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "threads_basic,threads_content_publish");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", user.id);

  const response = NextResponse.redirect(url.toString());
  // OAuth 과정에서 세션이 끊길 수 있으므로 user id를 쿠키에 저장
  response.cookies.set("threads_auth_uid", user.id, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // 10분
    path: "/",
  });

  return response;
}
