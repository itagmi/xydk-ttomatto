"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

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
  const mealLines = (Object.entries(meals) as [MealType, MealItem[]][])
    .filter(([, items]) => items.length > 0)
    .map(([type, items]) => {
      const kcal = items.reduce((s, i) => s + i.calories, 0);
      return `${MEAL_LABELS[type]}: ${items.map((i) => i.name).join(", ")} (${kcal}kcal)`;
    });

  if (mealLines.length === 0) {
    return `오늘 하루도 🍅\n\n#식단기록 #또마또`;
  }

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `오늘 식단으로 Threads에 올릴 짧은 포스트를 써줘.

오늘 식단:
${mealLines.join("\n")}
총 ${totalCalories}kcal / 목표 2000kcal

조건:
- 2~4줄로 짧게, 자연스럽고 솔직한 한국어
- 이모지 2~3개
- 마지막 줄에 #식단기록 #또마또 포함
- 텍스트만 출력 (설명 없이)`,
      },
    ],
  });

  return response.content.find((b) => b.type === "text")?.text ?? "";
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
