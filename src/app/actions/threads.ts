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

export async function postToThreads(text: string): Promise<void> {
  const dbUser = await getDbUser();
  if (!dbUser?.threadsAccessToken || !dbUser.threadsUserId) {
    throw new Error("Threads가 연결되지 않았어요");
  }

  const { threadsUserId: userId, threadsAccessToken: token } = dbUser;

  // 1. 컨테이너 생성
  const createUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  createUrl.searchParams.set("media_type", "TEXT");
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", token);

  const createRes = await fetch(createUrl.toString(), { method: "POST" });
  const createData = await createRes.json();

  if (!createData.id) {
    throw new Error(createData.error?.message ?? "게시물 생성 실패");
  }

  // 2. 발행
  const publishUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads_publish`);
  publishUrl.searchParams.set("creation_id", createData.id);
  publishUrl.searchParams.set("access_token", token);

  const publishRes = await fetch(publishUrl.toString(), { method: "POST" });
  const publishData = await publishRes.json();

  if (!publishData.id) {
    throw new Error(publishData.error?.message ?? "게시물 발행 실패");
  }
}
