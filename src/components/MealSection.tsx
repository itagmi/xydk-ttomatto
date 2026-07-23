"use client";

import { useRef, useState } from "react";
import {
  IconCamera,
  IconX,
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconPencil,
  IconPlus,
  IconPhoto,
} from "@tabler/icons-react";
import MealCard from "@/components/MealCard";
import { saveMealAnalysis, updateMealFoods, estimateFoodCalories, addMealPhoto } from "@/app/actions/meal";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type MealItem = { name: string; calories: number };
type MealsData = Record<MealType, MealItem[]>;

type AnalysisResult = {
  foods: { name: string; portion?: string | null; calories: number }[];
  totalCalories: number;
  imageUrl?: string;
};

type EditedFood = {
  name: string;
  portion: string | null;
  calories: number;
  nameEdited: boolean;
  recalculating: boolean;
};

type DrawerState =
  | { step: "closed" }
  | { step: "pick"; mealType: MealType }
  | { step: "analyzing"; mealType: MealType; preview: string }
  | { step: "result"; mealType: MealType; preview: string; imageUrl?: string; edited: EditedFood[] }
  | { step: "manual"; mealType: MealType; edited: EditedFood[] }
  | { step: "editing"; mealType: MealType; edited: EditedFood[] }
  | { step: "saving"; mealType: MealType }
  | { step: "error"; mealType: MealType; message: string };

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: "아침",
  LUNCH: "점심",
  DINNER: "저녁",
  SNACK: "간식",
};

function FoodRows({
  edited,
  onUpdate,
  onRemove,
  onRecalculate,
}: {
  edited: EditedFood[];
  onUpdate: (i: number, patch: Partial<EditedFood>) => void;
  onRemove: (i: number) => void;
  onRecalculate: (i: number) => void;
}) {
  return (
    <ul className="space-y-2">
      {edited.map((food, i) => (
        <li key={i} className="bg-zinc-50 rounded-xl px-3 py-3 space-y-2">
          {/* 이름 행 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={food.name}
              onChange={(e) => onUpdate(i, { name: e.target.value, nameEdited: true })}
              className="flex-1 text-sm text-zinc-800 font-medium bg-transparent outline-none border-b border-zinc-300 focus:border-tomato"
            />
            {food.nameEdited && (
              <button
                onClick={() => onRecalculate(i)}
                disabled={food.recalculating}
                className="flex items-center gap-1 text-xs text-tomato shrink-0 disabled:opacity-50"
              >
                <IconRefresh size={13} className={food.recalculating ? "animate-spin" : ""} />
                재계산
              </button>
            )}
            <button
              onClick={() => onRemove(i)}
              className="w-6 h-6 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-400 shrink-0"
            >
              <IconX size={13} />
            </button>
          </div>

          {/* AI 계량 + 칼로리 */}
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs text-zinc-400 truncate">
              {food.portion ?? "직접 입력한 항목"}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="number"
                value={food.calories === 0 ? "" : food.calories}
                placeholder="0"
                onChange={(e) => onUpdate(i, { calories: e.target.value === "" ? 0 : Number(e.target.value) || 0 })}
                className="w-16 text-right text-sm text-zinc-700 bg-transparent outline-none border-b border-zinc-300 focus:border-tomato placeholder:text-zinc-300"
              />
              <span className="text-xs text-zinc-400">kcal</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AddRow({
  newName,
  setNewName,
  newCalories,
  setNewCalories,
  estimating,
  onAdd,
}: {
  newName: string;
  setNewName: (v: string) => void;
  newCalories: string;
  setNewCalories: (v: string) => void;
  estimating: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="bg-zinc-50 rounded-xl px-3 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="음식 이름"
          className="flex-1 text-sm bg-transparent outline-none text-zinc-800 placeholder:text-zinc-400 border-b border-zinc-300 focus:border-tomato pb-0.5"
        />
        <button
          onClick={onAdd}
          disabled={!newName.trim() || estimating}
          className="w-7 h-7 rounded-full bg-tomato flex items-center justify-center text-white disabled:opacity-40 shrink-0"
        >
          {estimating ? <IconLoader2 size={14} className="animate-spin" /> : <IconPlus size={14} />}
        </button>
      </div>
      <input
        type="number"
        value={newCalories}
        onChange={(e) => setNewCalories(e.target.value)}
        placeholder="kcal (비우면 AI가 양과 칼로리를 추정해요)"
        className="w-full text-right text-xs bg-transparent outline-none border-b border-zinc-200 focus:border-tomato text-zinc-600 placeholder:text-zinc-300"
      />
    </div>
  );
}

export default function MealSection({ meals, mealImages }: { meals: MealsData; mealImages?: Record<MealType, string[]> }) {
  const [drawer, setDrawer] = useState<DrawerState>({ step: "closed" });
  const [newName, setNewName] = useState("");
  const [newCalories, setNewCalories] = useState("");
  const [estimating, setEstimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoOnlyInputRef = useRef<HTMLInputElement>(null);

  function toEdited(items: MealItem[]): EditedFood[] {
    return items.map((f) => ({
      name: f.name,
      portion: null,
      calories: f.calories,
      nameEdited: false,
      recalculating: false,
    }));
  }

  function openDrawer(mealType: MealType) {
    setDrawer({ step: "pick", mealType });
  }

  function openEdit(mealType: MealType) {
    setDrawer({ step: "editing", mealType, edited: toEdited(meals[mealType]) });
  }

  function closeDrawer() {
    setDrawer({ step: "closed" });
    setNewName("");
    setNewCalories("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (photoOnlyInputRef.current) photoOnlyInputRef.current.value = "";
  }

  async function handlePhotoOnlyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || drawer.step !== "pick") return;

    const mealType = drawer.mealType;
    setDrawer({ step: "saving", mealType });
    try {
      const formData = new FormData();
      formData.append("image", file);
      await addMealPhoto(mealType, formData);
      closeDrawer();
    } catch {
      setDrawer({ step: "error", mealType, message: "사진 업로드에 실패했어요" });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || drawer.step !== "pick") return;

    const mealType = drawer.mealType;
    const preview = URL.createObjectURL(file);
    setDrawer({ step: "analyzing", mealType, preview });

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/analyze-meal", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "분석 실패");
      }
      const result: AnalysisResult = await res.json();
      // 기존 기록이 있으면 뒤에 이어붙인다
      setDrawer({
        step: "result",
        mealType,
        preview,
        imageUrl: result.imageUrl,
        edited: [
          ...toEdited(meals[mealType]),
          ...result.foods.map((f) => ({
            name: f.name,
            portion: f.portion ?? null,
            calories: f.calories,
            nameEdited: false,
            recalculating: false,
          })),
        ],
      });
    } catch (err) {
      setDrawer({
        step: "error",
        mealType,
        message: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  function getEdited(): EditedFood[] | null {
    if (drawer.step === "result" || drawer.step === "manual" || drawer.step === "editing")
      return drawer.edited;
    return null;
  }

  function setEdited(edited: EditedFood[]) {
    if (drawer.step === "result" || drawer.step === "manual" || drawer.step === "editing")
      setDrawer({ ...drawer, edited });
  }

  function updateFood(i: number, patch: Partial<EditedFood>) {
    // 비동기 재계산 중에도 최신 상태 기준으로 갱신되도록 함수형 업데이트 사용
    setDrawer((d) =>
      d.step === "result" || d.step === "manual" || d.step === "editing"
        ? { ...d, edited: d.edited.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) }
        : d
    );
  }

  function removeFood(i: number) {
    setDrawer((d) =>
      d.step === "result" || d.step === "manual" || d.step === "editing"
        ? { ...d, edited: d.edited.filter((_, idx) => idx !== i) }
        : d
    );
  }

  async function recalculate(i: number) {
    const edited = getEdited();
    if (!edited) return;
    const { name } = edited[i];
    updateFood(i, { recalculating: true });
    try {
      const result = await estimateFoodCalories(name);
      if (result.calories > 0) {
        updateFood(i, { calories: result.calories, portion: result.portion, recalculating: false, nameEdited: false });
      } else {
        // AI가 값을 못 주면 기존 칼로리 유지, 버튼은 남겨서 재시도 가능하게
        updateFood(i, { recalculating: false });
      }
    } catch {
      updateFood(i, { recalculating: false });
    }
  }

  async function addManualItem() {
    if (!newName.trim()) return;
    let calories = parseInt(newCalories);
    let portion: string | null = null;
    if (!calories || isNaN(calories)) {
      setEstimating(true);
      try {
        const result = await estimateFoodCalories(newName.trim());
        calories = result.calories;
        portion = result.portion;
      } catch {
        calories = 0;
      }
      setEstimating(false);
    }
    const newItem = { name: newName.trim(), portion, calories, nameEdited: false, recalculating: false };
    setDrawer((d) =>
      d.step === "result" || d.step === "manual" || d.step === "editing"
        ? { ...d, edited: [...d.edited, newItem] }
        : d
    );
    setNewName("");
    setNewCalories("");
  }

  async function handleSave() {
    if (drawer.step !== "result" && drawer.step !== "manual" && drawer.step !== "editing") return;
    const { mealType, edited } = drawer;
    setDrawer({ step: "saving", mealType });
    try {
      const action = drawer.step === "editing" ? updateMealFoods : saveMealAnalysis;
      await action({
        mealType,
        foods: edited.map((f) => ({ name: f.name, calories: f.calories, quantity: 1 })),
        imageUrl: drawer.step === "result" ? drawer.imageUrl : undefined,
      });
      closeDrawer();
    } catch {
      setDrawer({ step: "error", mealType, message: "저장 실패" });
    }
  }

  const isOpen = drawer.step !== "closed";
  const activeMeal = isOpen ? drawer.mealType : null;
  const edited = getEdited() ?? [];
  const totalKcal = edited.reduce((s, f) => s + f.calories, 0);

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 px-1">끼니 기록</h2>
        {(["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as MealType[]).map((type) => (
          <MealCard
            key={type}
            type={type}
            items={meals[type]}
            imageUrls={mealImages?.[type]}
            onAdd={() => openDrawer(type)}
            onEdit={() => openEdit(type)}
          />
        ))}
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={photoOnlyInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoOnlyChange} />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-zinc-900">
                {activeMeal ? MEAL_LABELS[activeMeal] : ""}{" "}
                {drawer.step === "editing" ? "수정" : "음식 추가"}
              </h3>
              <button onClick={closeDrawer} className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400">
                <IconX size={18} />
              </button>
            </div>

            {/* pick */}
            {drawer.step === "pick" && (
              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-tomato-muted rounded-2xl py-6 flex flex-col items-center gap-2 text-tomato hover:bg-tomato-light transition-colors"
                >
                  <span className="w-12 h-12 rounded-full bg-tomato-light flex items-center justify-center">
                    <IconCamera size={22} />
                  </span>
                  <span className="text-sm font-medium">사진으로 AI 분석</span>
                  <span className="text-xs text-zinc-400">카메라 또는 갤러리</span>
                </button>
                <button
                  onClick={() => setDrawer({ step: "manual", mealType: drawer.mealType, edited: toEdited(meals[drawer.mealType]) })}
                  className="w-full border-2 border-dashed border-zinc-200 rounded-2xl py-6 flex flex-col items-center gap-2 text-zinc-500 hover:bg-zinc-50 transition-colors"
                >
                  <span className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                    <IconPencil size={20} />
                  </span>
                  <span className="text-sm font-medium">직접 입력</span>
                  <span className="text-xs text-zinc-400">음식 이름으로 검색</span>
                </button>
                <button
                  onClick={() => photoOnlyInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-zinc-200 rounded-2xl py-4 flex items-center justify-center gap-2 text-zinc-500 hover:bg-zinc-50 transition-colors"
                >
                  <IconPhoto size={18} />
                  <span className="text-sm font-medium">사진만 추가</span>
                  <span className="text-xs text-zinc-400">칼로리 계산 없이</span>
                </button>
              </div>
            )}

            {/* analyzing */}
            {drawer.step === "analyzing" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <img src={drawer.preview} alt="" className="w-full max-h-52 object-cover rounded-2xl" />
                <div className="flex items-center gap-2 text-tomato">
                  <IconLoader2 size={20} className="animate-spin" />
                  <span className="text-sm font-medium">AI가 분석 중이에요...</span>
                </div>
              </div>
            )}

            {/* manual */}
            {drawer.step === "manual" && (
              <div className="space-y-4">
                <FoodRows edited={edited} onUpdate={updateFood} onRemove={removeFood} onRecalculate={recalculate} />
                <AddRow newName={newName} setNewName={setNewName} newCalories={newCalories} setNewCalories={setNewCalories} estimating={estimating} onAdd={addManualItem} />
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm text-zinc-500">합계</span>
                  <span className="text-sm font-bold text-tomato">{totalKcal.toLocaleString()} kcal</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDrawer({ step: "pick", mealType: drawer.mealType })} className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">뒤로</button>
                  <button onClick={handleSave} disabled={edited.length === 0} className="flex-1 py-3 rounded-2xl bg-tomato text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-40">
                    <IconCheck size={16} />저장하기
                  </button>
                </div>
              </div>
            )}

            {/* editing */}
            {drawer.step === "editing" && (
              <div className="space-y-4">
                <FoodRows edited={edited} onUpdate={updateFood} onRemove={removeFood} onRecalculate={recalculate} />
                <AddRow newName={newName} setNewName={setNewName} newCalories={newCalories} setNewCalories={setNewCalories} estimating={estimating} onAdd={addManualItem} />
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm text-zinc-500">합계</span>
                  <span className="text-sm font-bold text-tomato">{totalKcal.toLocaleString()} kcal</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={closeDrawer} className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">취소</button>
                  <button onClick={handleSave} className="flex-1 py-3 rounded-2xl bg-tomato text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                    <IconCheck size={16} />저장하기
                  </button>
                </div>
              </div>
            )}

            {/* result */}
            {drawer.step === "result" && (
              <div className="space-y-4">
                <img src={drawer.preview} alt="" className="w-full max-h-44 object-cover rounded-2xl" />
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">분석 결과</p>
                  <FoodRows edited={edited} onUpdate={updateFood} onRemove={removeFood} onRecalculate={recalculate} />
                  <div className="flex justify-between items-center mt-3 px-1">
                    <span className="text-sm text-zinc-500">합계</span>
                    <span className="text-sm font-bold text-tomato">{totalKcal.toLocaleString()} kcal</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDrawer({ step: "pick", mealType: drawer.mealType })} className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">다시 찍기</button>
                  <button onClick={handleSave} className="flex-1 py-3 rounded-2xl bg-tomato text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                    <IconCheck size={16} />저장하기
                  </button>
                </div>
              </div>
            )}

            {/* saving */}
            {drawer.step === "saving" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <IconLoader2 size={28} className="animate-spin text-tomato" />
                <span className="text-sm text-zinc-500">저장 중...</span>
              </div>
            )}

            {/* error */}
            {drawer.step === "error" && (
              <div className="flex flex-col items-center gap-4 py-6">
                <p className="text-sm text-red-500 text-center">{drawer.message}</p>
                <button onClick={() => setDrawer({ step: "pick", mealType: drawer.mealType })} className="px-6 py-2.5 rounded-2xl bg-zinc-900 text-white text-sm font-medium">다시 시도</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
