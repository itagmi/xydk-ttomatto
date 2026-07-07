import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(`${origin}/?error=threads_auth`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.redirect(`${origin}/auth/login`);
  }

  const redirectUri = `${origin}/auth/threads/callback`;

  // 단기 토큰 교환
  const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      client_secret: process.env.THREADS_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return Response.redirect(`${origin}/?error=threads_token`);
  }

  // 장기 토큰 교환 (60일)
  const longRes = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${process.env.THREADS_APP_SECRET}&access_token=${tokenData.access_token}`
  );
  const longData = await longRes.json();

  const accessToken = longData.access_token ?? tokenData.access_token;
  const expiresIn = longData.expires_in ?? 3600;
  const threadsUserId = String(tokenData.user_id);

  await prisma.user.update({
    where: { authId: user.id },
    data: {
      threadsUserId,
      threadsAccessToken: accessToken,
      threadsTokenExpiry: new Date(Date.now() + expiresIn * 1000),
    },
  });

  return Response.redirect(`${origin}/`);
}
