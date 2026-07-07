const APP_URL = "https://ttomatto.vercel.app";
const REDIRECT_URI = `${APP_URL}/auth/threads/callback`;

export async function GET() {
  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", process.env.THREADS_APP_ID!);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "threads_basic,threads_content_publish");
  url.searchParams.set("response_type", "code");

  return Response.redirect(url.toString());
}
