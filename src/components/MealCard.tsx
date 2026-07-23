"use client";

import {
  IconCoffee,
  IconSoup,
  IconMoon,
  IconCup,
  IconPencil,
} from "@tabler/icons-react";

type MealItem = {
  name: string;
  calories: number;
};

type MealCardProps = {
  type: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  items: MealItem[];
  imageUrls?: string[];
  onAdd?: () => void;
  onEdit?: () => void;
  onPhotoOnly?: () => void;
};

const MEAL_META = {
  BREAKFAST: { label: "아침", Icon: IconCoffee, iconBg: "bg-amber-50", iconColor: "text-amber-500" },
  LUNCH: { label: "점심", Icon: IconSoup, iconBg: "bg-sky-50", iconColor: "text-sky-500" },
  DINNER: { label: "저녁", Icon: IconMoon, iconBg: "bg-indigo-50", iconColor: "text-indigo-400" },
  SNACK: { label: "간식", Icon: IconCup, iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
} as const;

export default function MealCard({ type, items = [], imageUrls = [], onAdd, onEdit, onPhotoOnly }: MealCardProps) {
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
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <>
              <span className="text-sm font-semibold text-tomato">
                {totalCalories.toLocaleString()} kcal
              </span>
              <button
                onClick={onEdit}
                className="w-7 h-7 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 transition-colors"
              >
                <IconPencil size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {imageUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
            ))}
          </div>
        )}
        {isEmpty ? (
          imageUrls.length === 0 && <p className="text-sm text-zinc-400 pl-1">아직 기록이 없어요</p>
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
      </div>

      <div className="mt-3 flex items-center gap-4 pl-1">
        <button
          onClick={onAdd}
          className="text-xs text-zinc-400 hover:text-tomato transition-colors flex items-center gap-1"
        >
          <span className="text-base leading-none">+</span>
          <span>음식 AI로 분석</span>
        </button>
        <button
          onClick={onPhotoOnly}
          className="text-xs text-zinc-400 hover:text-tomato transition-colors flex items-center gap-1"
        >
          <span className="text-base leading-none">+</span>
          <span>사진만 추가</span>
        </button>
      </div>
    </div>
  );
}
