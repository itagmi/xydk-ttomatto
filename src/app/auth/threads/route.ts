import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/auth/threads/callback`;

  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", process.env.THREADS_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "threads_basic,threads_content_publish");
  url.searchParams.set("response_type", "code");

  return Response.redirect(url.toString());
}
