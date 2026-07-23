"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type MealItem = { name: string; calories: number };
type MealsData = Record<MealType, MealItem[]>;

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "아침",
  LUNCH: "점심",
  DINNER: "저녁",
  SNACK: "간식",
};

async function getDbUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return prisma.user.findUnique({ where: { authId: user.id } });
}

async function getTodayImageUrls(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diary = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: dbUser.id, date: today } },
    include: { meals: { select: { imageUrls: true } } },
  });

  return (diary?.meals ?? []).flatMap((m) => m.imageUrls);
}

export async function getThreadsStatus() {
  const dbUser = await getDbUser();
  return { connected: !!dbUser?.threadsAccessToken };
}

export async function generatePost(
  meals: MealsData,
  totalCalories: number
): Promise<string> {
  const lines = (Object.entries(meals) as [MealType, MealItem[]][]).map(([type, items]) =>
    items.length > 0
      ? `• ${MEAL_LABELS[type]} : ${items.map((i) => i.name).join(", ")}`
      : `• ${MEAL_LABELS[type]} : ❌`
  );

  lines.push(`\n🍅 총 : ${totalCalories.toLocaleString("ko-KR")} kcal 🍅`);

  return lines.join("\n");
}

export async function postToThreads(
  text: string,
  orderedImageUrls?: string[]
): Promise<{ success: true; permalink?: string } | { success: false; error: string }> {
  try {
    const dbUser = await getDbUser();
    if (!dbUser?.threadsAccessToken || !dbUser.threadsUserId) {
      return { success: false, error: "Threads가 연결되지 않았어요" };
    }

    // 저장된 threadsUserId가 오래됐거나 틀릴 수 있으므로 "me" 사용
    const userId = "me";
    let token = dbUser.threadsAccessToken;

    // 장기 토큰(60일)은 만료 전에 갱신해야 한다. 만료 10일 전부터 자동 갱신 시도
    const expiry = dbUser.threadsTokenExpiry;
    if (expiry && expiry.getTime() - Date.now() < 10 * 24 * 60 * 60 * 1000) {
      try {
        const refreshed = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`
        ).then((r) => r.json());
        if (refreshed.access_token) {
          token = refreshed.access_token;
          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              threadsAccessToken: refreshed.access_token,
              threadsTokenExpiry: new Date(Date.now() + (refreshed.expires_in ?? 60 * 60 * 24 * 60) * 1000),
            },
          });
        }
      } catch {
        // 갱신 실패해도 기존 토큰으로 시도
      }
    }

    // 클라이언트에서 정한 순서가 있으면 그대로 사용
    let imageUrls: string[] = orderedImageUrls ?? [];
    if (!orderedImageUrls) {
      try {
        imageUrls = await getTodayImageUrls();
      } catch {
        imageUrls = [];
      }
    }

    // Threads는 JPEG/PNG만 지원 — gif 등은 "Invalid parameter"로 게시 전체가 실패하므로 제외
    imageUrls = imageUrls.filter((u) => !/\.gif(\?|$)/i.test(u));

    let mediaId: string;
    if (imageUrls.length === 0) {
      mediaId = await publishText(userId, token, text);
    } else if (imageUrls.length === 1) {
      mediaId = await publishSingleImage(userId, token, text, imageUrls[0]);
    } else {
      mediaId = await publishCarousel(userId, token, text, imageUrls);
    }

    const permalink = await getPermalink(mediaId, token);
    return { success: true, permalink };
  } catch (err) {
    const message = err instanceof Error ? err.message : "발행 실패";
    // 진짜 인증 문제일 때만 재연결 안내 ("Invalid parameter" 같은 일반 오류는 제외)
    const needsReconnect = /oauth|access token|session has expired|not authorized/i.test(message);
    return {
      success: false,
      error: needsReconnect
        ? `Threads 연결이 만료됐어요. 재연결이 필요합니다. (${message})`
        : `게시 실패: ${message}`,
    };
  }
}

async function publishText(userId: string, token: string, text: string): Promise<string> {
  const createUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  createUrl.searchParams.set("media_type", "TEXT");
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", token);

  const createData = await fetch(createUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!createData.id) {
    console.error("[threads] text container failed:", JSON.stringify(createData));
    throw new Error(createData.error?.message ?? "게시물 생성 실패");
  }

  return publish(userId, token, createData.id);
}

async function publishSingleImage(userId: string, token: string, text: string, imageUrl: string): Promise<string> {
  const createUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  createUrl.searchParams.set("media_type", "IMAGE");
  createUrl.searchParams.set("image_url", imageUrl);
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", token);

  const createData = await fetch(createUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!createData.id) {
    console.error("[threads] image container failed:", JSON.stringify(createData));
    throw new Error(createData.error?.message ?? "이미지 게시물 생성 실패");
  }

  return publish(userId, token, createData.id);
}

async function publishCarousel(userId: string, token: string, text: string, imageUrls: string[]): Promise<string> {
  // 1. 캐러셀 아이템 생성
  const itemIds: string[] = [];
  for (const imageUrl of imageUrls.slice(0, 10)) { // Threads 최대 10장
    const url = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
    url.searchParams.set("media_type", "IMAGE");
    url.searchParams.set("image_url", imageUrl);
    url.searchParams.set("is_carousel_item", "true");
    url.searchParams.set("access_token", token);

    const data = await fetch(url.toString(), { method: "POST" }).then((r) => r.json());
    if (data.id) itemIds.push(data.id);
    else console.error("[threads] carousel item failed:", imageUrl, JSON.stringify(data));
  }

  if (itemIds.length === 0) {
    return publishText(userId, token, text);
  }

  // 2. 캐러셀 컨테이너 생성
  const carouselUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  carouselUrl.searchParams.set("media_type", "CAROUSEL");
  carouselUrl.searchParams.set("children", itemIds.join(","));
  carouselUrl.searchParams.set("text", text);
  carouselUrl.searchParams.set("access_token", token);

  const carouselData = await fetch(carouselUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!carouselData.id) {
    console.error("[threads] carousel container failed:", JSON.stringify(carouselData));
    throw new Error(carouselData.error?.message ?? "캐러셀 생성 실패");
  }

  return publish(userId, token, carouselData.id);
}

async function publish(userId: string, token: string, creationId: string): Promise<string> {
  const publishUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads_publish`);
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", token);

  // 컨테이너 생성 직후엔 Threads 내부 전파 지연으로 "미디어를 찾을 수 없음"(subcode 4279009)이
  // 날 수 있어 잠시 기다렸다 재시도한다
  let lastMessage = "게시물 발행 실패";
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));

    const publishData = await fetch(publishUrl.toString(), { method: "POST" }).then((r) => r.json());
    if (publishData.id) return publishData.id;

    lastMessage = publishData.error?.message ?? lastMessage;
    const retryable =
      publishData.error?.code === 24 ||
      publishData.error?.error_subcode === 4279009 ||
      publishData.error?.is_transient === true;

    console.error(`[threads] publish attempt ${attempt + 1} failed:`, JSON.stringify(publishData));
    if (!retryable) throw new Error(lastMessage);
  }
  throw new Error(lastMessage);
}

async function getPermalink(mediaId: string, token: string): Promise<string | undefined> {
  try {
    const url = new URL(`https://graph.threads.net/v1.0/${mediaId}`);
    url.searchParams.set("fields", "permalink");
    url.searchParams.set("access_token", token);
    const data = await fetch(url.toString()).then((r) => r.json());
    return data.permalink ?? undefined;
  } catch {
    return undefined;
  }
}
