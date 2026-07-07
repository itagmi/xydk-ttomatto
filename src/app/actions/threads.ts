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
    include: { meals: { select: { imageUrl: true } } },
  });

  return (diary?.meals ?? [])
    .map((m) => m.imageUrl)
    .filter((url): url is string => !!url);
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

export async function postToThreads(text: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const dbUser = await getDbUser();
    if (!dbUser?.threadsAccessToken || !dbUser.threadsUserId) {
      return { success: false, error: "Threads가 연결되지 않았어요" };
    }

    const { threadsUserId: userId, threadsAccessToken: token } = dbUser;

    let imageUrls: string[] = [];
    try {
      imageUrls = await getTodayImageUrls();
    } catch {
      imageUrls = [];
    }

    if (imageUrls.length === 0) {
      await publishText(userId, token, text);
    } else if (imageUrls.length === 1) {
      await publishSingleImage(userId, token, text, imageUrls[0]);
    } else {
      await publishCarousel(userId, token, text, imageUrls);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "발행 실패";
    const needsReconnect = message.toLowerCase().includes("unsupported") ||
      message.toLowerCase().includes("invalid") ||
      message.toLowerCase().includes("token") ||
      message.toLowerCase().includes("oauth");
    return {
      success: false,
      error: needsReconnect
        ? `Threads 연결이 만료됐어요. 재연결이 필요합니다. (${message})`
        : message,
    };
  }
}

async function publishText(userId: string, token: string, text: string) {
  const createUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  createUrl.searchParams.set("media_type", "TEXT");
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", token);

  const createData = await fetch(createUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!createData.id) throw new Error(createData.error?.message ?? "게시물 생성 실패");

  await publish(userId, token, createData.id);
}

async function publishSingleImage(userId: string, token: string, text: string, imageUrl: string) {
  const createUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  createUrl.searchParams.set("media_type", "IMAGE");
  createUrl.searchParams.set("image_url", imageUrl);
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", token);

  const createData = await fetch(createUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!createData.id) throw new Error(createData.error?.message ?? "이미지 게시물 생성 실패");

  await publish(userId, token, createData.id);
}

async function publishCarousel(userId: string, token: string, text: string, imageUrls: string[]) {
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
  }

  if (itemIds.length === 0) {
    await publishText(userId, token, text);
    return;
  }

  // 2. 캐러셀 컨테이너 생성
  const carouselUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  carouselUrl.searchParams.set("media_type", "CAROUSEL");
  carouselUrl.searchParams.set("children", itemIds.join(","));
  carouselUrl.searchParams.set("text", text);
  carouselUrl.searchParams.set("access_token", token);

  const carouselData = await fetch(carouselUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!carouselData.id) throw new Error(carouselData.error?.message ?? "캐러셀 생성 실패");

  await publish(userId, token, carouselData.id);
}

async function publish(userId: string, token: string, creationId: string) {
  const publishUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads_publish`);
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", token);

  const publishData = await fetch(publishUrl.toString(), { method: "POST" }).then((r) => r.json());
  if (!publishData.id) throw new Error(publishData.error?.message ?? "게시물 발행 실패");
}
