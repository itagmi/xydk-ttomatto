import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const APP_URL = "https://ttomatto.vercel.app";
const REDIRECT_URI = `${APP_URL}/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    console.error("[threads/callback] error param:", error);
    return Response.redirect(`${APP_URL}/?error=threads_auth`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[threads/callback] no supabase user");
    return Response.redirect(`${APP_URL}/auth/login`);
  }
  console.log("[threads/callback] user:", user.id);

  // 단기 토큰 교환
  const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      client_secret: process.env.THREADS_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  console.log("[threads/callback] tokenData:", JSON.stringify(tokenData));
  if (!tokenData.access_token) {
    return Response.redirect(`${APP_URL}/?error=threads_token`);
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

  return Response.redirect(`${APP_URL}/`);
}
