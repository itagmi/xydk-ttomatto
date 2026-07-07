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

export async function estimateFoodCalories(
  foodName: string,
  quantity = 1,
  unit = "개"
): Promise<number> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 50,
    messages: [
      {
        role: "user",
        content: `"${foodName}" ${quantity}${unit}의 칼로리를 숫자만 답해줘. 단위 없이 정수만.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "0";
  const nums = (text.match(/\d+/g) ?? []).map(Number);
  return nums.find((n) => n >= 10) ?? 0;
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
    update: data.imageUrl ? { imageUrl: data.imageUrl } : {},
    create: { diaryEntryId: diary.id, mealType: data.mealType, imageUrl: data.imageUrl },
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
