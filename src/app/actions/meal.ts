"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

const anthropic = new Anthropic();

async function getOrCreateDbUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  return prisma.user.upsert({
    where: { authId: user.id },
    update: {},
    create: {
      authId: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? null,
    },
  });
}

function todayUtcMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getTodayMeals() {
  const dbUser = await getOrCreateDbUser();
  const today = todayUtcMidnight();

  return prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: dbUser.id, date: today } },
    include: {
      meals: {
        include: { mealFoods: { include: { food: true } } },
      },
    },
  });
}

export async function getGoalCalories(): Promise<number> {
  const dbUser = await getOrCreateDbUser();
  return dbUser.goalCalories;
}

export async function updateGoalCalories(goal: number) {
  const n = Math.round(goal);
  if (!Number.isFinite(n) || n < 500 || n > 10000) {
    throw new Error("목표 칼로리는 500~10,000 사이여야 해요");
  }
  const dbUser = await getOrCreateDbUser();
  await prisma.user.update({ where: { id: dbUser.id }, data: { goalCalories: n } });
  revalidatePath("/");
}

export async function estimateFoodCalories(
  foodName: string
): Promise<{ calories: number; portion: string | null }> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `"${foodName}"의 일반적인 1회 섭취량과 그 양 기준 칼로리를 추정해줘. 반드시 다음 JSON만 출력해:
{"portion": "양 설명 (예: 1공기 (약 210g), 1잔 (약 355ml))", "calories": 숫자}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return {
      calories: Math.max(0, Math.round(Number(parsed.calories)) || 0),
      portion: typeof parsed.portion === "string" ? parsed.portion : null,
    };
  } catch {
    console.error("[estimateFoodCalories] parse failed:", text.slice(0, 200));
    return { calories: 0, portion: null };
  }
}

export async function saveMealAnalysis(data: {
  mealType: MealType;
  foods: { name: string; calories: number; quantity: number }[];
  imageUrl?: string;
}) {
  const dbUser = await getOrCreateDbUser();
  const today = todayUtcMidnight();

  const diary = await prisma.diaryEntry.upsert({
    where: { userId_date: { userId: dbUser.id, date: today } },
    update: {},
    create: { userId: dbUser.id, date: today },
  });

  const meal = await prisma.meal.upsert({
    where: {
      diaryEntryId_mealType: {
        diaryEntryId: diary.id,
        mealType: data.mealType,
      },
    },
    update: data.imageUrl ? { imageUrls: { push: data.imageUrl } } : {},
    create: {
      diaryEntryId: diary.id,
      mealType: data.mealType,
      imageUrls: data.imageUrl ? [data.imageUrl] : [],
    },
  });

  await prisma.mealFood.deleteMany({ where: { mealId: meal.id } });

  for (const item of data.foods) {
    const food = await prisma.food.create({
      data: {
        name: item.name,
        calories: item.calories,
        servingSize: 1,
        userId: dbUser.id,
      },
    });
    await prisma.mealFood.create({
      data: { mealId: meal.id, foodId: food.id, amount: item.quantity },
    });
  }

  revalidatePath("/");
}

export async function updateMealFoods(data: {
  mealType: MealType;
  foods: { name: string; calories: number; quantity: number }[];
}) {
  const dbUser = await getOrCreateDbUser();
  const today = todayUtcMidnight();

  const diary = await prisma.diaryEntry.upsert({
    where: { userId_date: { userId: dbUser.id, date: today } },
    update: {},
    create: { userId: dbUser.id, date: today },
  });

  const meal = await prisma.meal.upsert({
    where: { diaryEntryId_mealType: { diaryEntryId: diary.id, mealType: data.mealType } },
    update: {},
    create: { diaryEntryId: diary.id, mealType: data.mealType },
  });

  await prisma.mealFood.deleteMany({ where: { mealId: meal.id } });

  for (const item of data.foods) {
    const food = await prisma.food.create({
      data: { name: item.name, calories: item.calories, servingSize: 1, userId: dbUser.id },
    });
    await prisma.mealFood.create({
      data: { mealId: meal.id, foodId: food.id, amount: item.quantity },
    });
  }

  revalidatePath("/");
}
