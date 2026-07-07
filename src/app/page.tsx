import { IconLogout } from "@tabler/icons-react";
import MealSection from "@/components/MealSection";
import DailyCloseButton from "@/components/DailyCloseButton";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { getTodayMeals } from "@/app/actions/meal";
import { getThreadsStatus } from "@/app/actions/threads";

const GOAL_CALORIES = 2000;

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [diary, { connected: threadsConnected }] = await Promise.all([
    getTodayMeals(),
    getThreadsStatus(),
  ]);

  const meals: Record<MealType, MealItem[]> = {
    BREAKFAST: [],
    LUNCH: [],
    DINNER: [],
    SNACK: [],
  };

  if (diary) {
    for (const meal of diary.meals) {
      meals[meal.mealType as MealType] = meal.mealFoods.map((mf) => ({
        name: mf.food.name,
        calories: Math.round(mf.food.calories * mf.amount),
      }));
    }
  }

  const totalCalories = Object.values(meals)
    .flat()
    .reduce((sum, item) => sum + item.calories, 0);

  const progressPct = Math.min((totalCalories / GOAL_CALORIES) * 100, 100);
  const remaining = GOAL_CALORIES - totalCalories;

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
        <div className="bg-tomato rounded-2xl p-5 text-white shadow-md">
          <p className="text-sm font-medium text-white/70 mb-1">오늘 섭취 칼로리</p>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-bold tracking-tight">
              {totalCalories.toLocaleString()}
            </span>
            <span className="text-lg font-medium text-white/80 mb-0.5">kcal</span>
          </div>
          <div className="bg-white/20 rounded-full h-2 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/70">
            <span>목표 {GOAL_CALORIES.toLocaleString()} kcal까지</span>
            <span>{remaining > 0 ? `${remaining.toLocaleString()} kcal 남음` : "목표 달성!"}</span>
          </div>
        </div>

        {/* 끼니 카드들 + 업로드 드로어 */}
        <MealSection meals={meals} />
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#fff8f7] via-[#fff8f7] to-transparent pt-8 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <DailyCloseButton
            threadsConnected={threadsConnected}
            meals={meals}
            totalCalories={totalCalories}
          />
        </div>
      </div>
    </div>
  );
}
