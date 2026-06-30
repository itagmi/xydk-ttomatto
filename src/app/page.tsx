import { IconCamera, IconLogout } from "@tabler/icons-react";
import MealCard from "@/components/MealCard";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

const GOAL_CALORIES = 2000;

const MOCK_MEALS = {
  BREAKFAST: [
    { name: "현미밥 1공기", calories: 290 },
    { name: "된장찌개", calories: 110 },
    { name: "계란후라이", calories: 90 },
  ],
  LUNCH: [
    { name: "제육볶음 정식", calories: 620 },
  ],
  DINNER: [] as { name: string; calories: number }[],
  SNACK: [
    { name: "아몬드 한 줌", calories: 170 },
  ],
};

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

  const totalCalories = Object.values(MOCK_MEALS)
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
            <span>{remaining.toLocaleString()} kcal 남음</span>
          </div>
        </div>

        {/* 끼니 카드들 */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-500 px-1">끼니 기록</h2>
          <MealCard type="BREAKFAST" items={MOCK_MEALS.BREAKFAST} />
          <MealCard type="LUNCH" items={MOCK_MEALS.LUNCH} />
          <MealCard type="DINNER" items={MOCK_MEALS.DINNER} />
          <MealCard type="SNACK" items={MOCK_MEALS.SNACK} />
        </section>

        {/* 끼니 사진 추가 */}
        <button className="w-full border-2 border-dashed border-tomato-muted rounded-2xl py-4 flex flex-col items-center gap-1.5 text-tomato hover:bg-tomato-light transition-colors group">
          <span className="w-10 h-10 rounded-full bg-tomato-light group-hover:bg-tomato-muted flex items-center justify-center transition-colors">
            <IconCamera size={20} />
          </span>
          <span className="text-sm font-medium">끼니 사진 추가하기</span>
        </button>
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#fff8f7] via-[#fff8f7] to-transparent pt-8 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <button className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-semibold rounded-2xl py-4 flex items-center justify-center gap-2.5 transition-colors shadow-lg">
            <span className="text-lg">🍅</span>
            <span>오늘 마감하고 Threads에 올리기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
