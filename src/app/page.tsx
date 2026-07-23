import { IconLogout } from "@tabler/icons-react";
import MealSection from "@/components/MealSection";
import DailyCloseButton from "@/components/DailyCloseButton";
import CalorieCard from "@/components/CalorieCard";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { getTodayMeals, getGoalCalories } from "@/app/actions/meal";
import { getThreadsStatus } from "@/app/actions/threads";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type MealItem = { name: string; calories: number };

function getTodayLabel() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayStr = now.toLocaleDateString("ko-KR", { weekday: "long" });
  return { dateStr, dayStr };
}

export default async function Home() {
  const { dateStr, dayStr } = getTodayLabel();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [diary, threadsResult, goalCalories] = await Promise.all([
    getTodayMeals().catch(() => null),
    getThreadsStatus().catch(() => ({ connected: false })),
    getGoalCalories().catch(() => 2000),
  ]);

  const threadsConnected = threadsResult.connected;

  const meals: Record<MealType, MealItem[]> = {
    BREAKFAST: [],
    LUNCH: [],
    DINNER: [],
    SNACK: [],
  };

  const mealImages: Record<MealType, string[]> = {
    BREAKFAST: [],
    LUNCH: [],
    DINNER: [],
    SNACK: [],
  };

  if (diary) {
    for (const meal of diary.meals) {
      const type = meal.mealType as MealType;
      meals[type] = meal.mealFoods.map((mf) => ({
        name: mf.food.name,
        calories: Math.round(mf.food.calories * mf.amount),
      }));
      mealImages[type] = meal.imageUrls;
    }
  }

  const totalCalories = Object.values(meals)
    .flat()
    .reduce((sum, item) => sum + item.calories, 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-zinc-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍅</span>
          <span className="text-xl font-bold text-tomato tracking-tight">또마또</span>
        </div>
        <div className="flex items-center gap-2">
          {user?.user_metadata?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.user_metadata.avatar_url}
              alt="프로필"
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="w-9 h-9 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 transition-colors"
            >
              <IconLogout size={18} />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-5 pb-36 space-y-4">
        {/* 날짜 */}
        <div>
          <p className="text-xs font-medium text-tomato uppercase tracking-widest">{dayStr}</p>
          <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">{dateStr}</h1>
        </div>

        {/* 누적 칼로리 카드 */}
        <CalorieCard totalCalories={totalCalories} goalCalories={goalCalories} />

        {/* 끼니 카드들 */}
        <MealSection meals={meals} mealImages={mealImages} />
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#fff8f7] via-[#fff8f7] to-transparent pt-8 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <DailyCloseButton
            threadsConnected={threadsConnected}
            meals={meals}
            mealImages={mealImages}
            totalCalories={totalCalories}
          />
        </div>
      </div>
    </div>
  );
}
