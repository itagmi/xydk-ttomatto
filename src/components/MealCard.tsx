"use client";

import {
  IconCoffee,
  IconSoup,
  IconMoon,
  IconCup,
} from "@tabler/icons-react";

type MealItem = {
  name: string;
  calories: number;
};

type MealCardProps = {
  type: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  items: MealItem[];
  onAdd?: () => void;
};

const MEAL_META = {
  BREAKFAST: { label: "아침", Icon: IconCoffee, iconBg: "bg-amber-50", iconColor: "text-amber-500" },
  LUNCH: { label: "점심", Icon: IconSoup, iconBg: "bg-sky-50", iconColor: "text-sky-500" },
  DINNER: { label: "저녁", Icon: IconMoon, iconBg: "bg-indigo-50", iconColor: "text-indigo-400" },
  SNACK: { label: "간식", Icon: IconCup, iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
} as const;

export default function MealCard({ type, items = [], onAdd }: MealCardProps) {
  const { label, Icon, iconBg, iconColor } = MEAL_META[type];
  const totalCalories = items.reduce((sum, item) => sum + item.calories, 0);
  const isEmpty = items.length === 0;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center`}>
            <Icon size={18} className={iconColor} />
          </span>
          <span className="font-semibold text-zinc-800">{label}</span>
        </div>
        {!isEmpty && (
          <span className="text-sm font-semibold text-tomato">
            {totalCalories.toLocaleString()} kcal
          </span>
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm text-zinc-400 pl-1">아직 기록이 없어요</p>
      ) : (
        <ul className="space-y-1.5 pl-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">{item.name}</span>
              <span className="text-xs text-zinc-400">{item.calories} kcal</span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onAdd}
        className="mt-3 w-full text-xs text-zinc-400 hover:text-tomato transition-colors text-left pl-1 flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span>
        <span>음식 추가</span>
      </button>
    </div>
  );
}
