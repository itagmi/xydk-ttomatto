import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyState } from "@/lib/threads-state";

const APP_URL = "https://ttomatto.vercel.app";
const REDIRECT_URI = `${APP_URL}/auth/threads/callback`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    console.error("[threads/callback] error:", error);
    return NextResponse.redirect(`${APP_URL}/?error=threads_auth`);
  }

  // 쿠키 우선, 없으면(PWA 등에서 유실) 서명된 state로 식별
  const authUid =
    request.cookies.get("threads_auth_uid")?.value ??
    verifyState(request.nextUrl.searchParams.get("state"));
  if (!authUid) {
    console.error("[threads/callback] no threads_auth_uid cookie and invalid state");
    return NextResponse.redirect(`${APP_URL}/auth/login`);
  }

  console.log("[threads/callback] authUid:", authUid);

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
    return NextResponse.redirect(`${APP_URL}/?error=threads_token`);
  }

  // 장기 토큰 교환 (60일) — 실패 시 1회 재시도, 그래도 실패하면 단기 토큰을 저장하지 않고 에러
  // (단기 토큰은 1시간 뒤 만료되어 "연결 유실"처럼 보이기 때문)
  const exchangeLong = () =>
    fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${process.env.THREADS_APP_SECRET}&access_token=${tokenData.access_token}`
    ).then((r) => r.json());

  let longData = await exchangeLong().catch(() => ({}));
  if (!longData.access_token) {
    console.error("[threads/callback] long token exchange failed, retrying:", JSON.stringify(longData));
    longData = await exchangeLong().catch(() => ({}));
  }
  if (!longData.access_token) {
    console.error("[threads/callback] long token exchange failed twice:", JSON.stringify(longData));
    return NextResponse.redirect(`${APP_URL}/?error=threads_token`);
  }

  const accessToken = longData.access_token;
  const expiresIn = longData.expires_in ?? 60 * 60 * 24 * 60;
  const threadsUserId = String(tokenData.user_id);

  await prisma.user.update({
    where: { authId: authUid },
    data: {
      threadsUserId,
      threadsAccessToken: accessToken,
      threadsTokenExpiry: new Date(Date.now() + expiresIn * 1000),
    },
  });

  console.log("[threads/callback] saved token for user:", authUid);

  const response = NextResponse.redirect(`${APP_URL}/`);
  response.cookies.delete("threads_auth_uid");
  return response;
}
