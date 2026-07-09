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
} from "@tabler/icons-react";
import MealCard from "@/components/MealCard";
import { saveMealAnalysis, updateMealFoods, estimateFoodCalories } from "@/app/actions/meal";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type MealItem = { name: string; calories: number };
type MealsData = Record<MealType, MealItem[]>;

type AnalysisResult = {
  foods: { name: string; calories: number }[];
  totalCalories: number;
  imageUrl?: string;
};

type EditedFood = {
  name: string;
  calories: number;
  quantity: number;
  unit: string;
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

const UNITS = ["개", "g", "ml", "컵", "큰술"];

function unitStep(unit: string) {
  return unit === "g" || unit === "ml" ? 10 : 0.5;
}
function unitMin(unit: string) {
  return unit === "g" || unit === "ml" ? 10 : 0.5;
}

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

          {/* 단위 선택 */}
          <div className="flex gap-1">
            {UNITS.map((u) => (
              <button
                key={u}
                onClick={() => onUpdate(i, { unit: u, nameEdited: true })}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  food.unit === u
                    ? "bg-tomato text-white"
                    : "bg-white border border-zinc-200 text-zinc-500 hover:border-tomato hover:text-tomato"
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          {/* 수량 × 칼로리 */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={food.quantity === 0 ? "" : food.quantity}
              min={0}
              step={unitStep(food.unit)}
              onChange={(e) => onUpdate(i, { quantity: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
              className="w-16 text-center text-sm text-zinc-700 bg-white rounded-lg border border-zinc-200 outline-none py-0.5 focus:border-tomato"
            />
            <span className="text-xs text-zinc-500">{food.unit}</span>
            <span className="text-zinc-300 text-sm">×</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={food.calories === 0 ? "" : food.calories}
                placeholder="0"
                onChange={(e) => onUpdate(i, { calories: e.target.value === "" ? 0 : Number(e.target.value) || 0 })}
                className="w-16 text-right text-sm text-zinc-700 bg-transparent outline-none border-b border-zinc-300 focus:border-tomato placeholder:text-zinc-300"
              />
              <span className="text-xs text-zinc-400">kcal</span>
            </div>
            {food.quantity !== 1 && (
              <>
                <span className="text-zinc-300 text-sm">=</span>
                <span className="text-sm font-bold text-tomato">
                  {Math.round(food.calories * food.quantity).toLocaleString()} kcal
                </span>
              </>
            )}
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
  newUnit,
  setNewUnit,
  estimating,
  onAdd,
}: {
  newName: string;
  setNewName: (v: string) => void;
  newCalories: string;
  setNewCalories: (v: string) => void;
  newUnit: string;
  setNewUnit: (v: string) => void;
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
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {UNITS.map((u) => (
            <button
              key={u}
              onClick={() => setNewUnit(u)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                newUnit === u
                  ? "bg-tomato text-white"
                  : "bg-white border border-zinc-200 text-zinc-500 hover:border-tomato hover:text-tomato"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={newCalories}
          onChange={(e) => setNewCalories(e.target.value)}
          placeholder="kcal (비우면 AI 추정)"
          className="flex-1 text-right text-xs bg-transparent outline-none border-b border-zinc-200 focus:border-tomato text-zinc-600 placeholder:text-zinc-300"
        />
      </div>
    </div>
  );
}

export default function MealSection({ meals, mealImages }: { meals: MealsData; mealImages?: Record<MealType, string | null> }) {
  const [drawer, setDrawer] = useState<DrawerState>({ step: "closed" });
  const [newName, setNewName] = useState("");
  const [newCalories, setNewCalories] = useState("");
  const [newUnit, setNewUnit] = useState("개");
  const [estimating, setEstimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openDrawer(mealType: MealType) {
    setDrawer({ step: "pick", mealType });
  }

  function openEdit(mealType: MealType) {
    setDrawer({
      step: "editing",
      mealType,
      edited: meals[mealType].map((f) => ({
        name: f.name,
        calories: f.calories,
        quantity: 1,
        unit: "개",
        nameEdited: false,
        recalculating: false,
      })),
    });
  }

  function closeDrawer() {
    setDrawer({ step: "closed" });
    setNewName("");
    setNewCalories("");
    setNewUnit("개");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      setDrawer({
        step: "result",
        mealType,
        preview,
        imageUrl: result.imageUrl,
        edited: result.foods.map((f) => ({
          name: f.name,
          calories: f.calories,
          quantity: 1,
          unit: "개",
          nameEdited: false,
          recalculating: false,
        })),
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
    const edited = getEdited();
    if (!edited) return;
    setEdited(edited.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFood(i: number) {
    const edited = getEdited();
    if (!edited) return;
    setEdited(edited.filter((_, idx) => idx !== i));
  }

  async function recalculate(i: number) {
    const edited = getEdited();
    if (!edited) return;
    const { name, quantity, unit } = edited[i];
    updateFood(i, { recalculating: true, nameEdited: false });
    try {
      const calories = await estimateFoodCalories(name, quantity, unit);
      updateFood(i, { calories, recalculating: false });
    } catch {
      updateFood(i, { recalculating: false });
    }
  }

  async function addManualItem() {
    if (!newName.trim()) return;
    let calories = parseInt(newCalories);
    if (!calories || isNaN(calories)) {
      setEstimating(true);
      try {
        calories = await estimateFoodCalories(newName.trim(), 1, newUnit);
      } catch {
        calories = 0;
      }
      setEstimating(false);
    }
    const edited = getEdited() ?? [];
    setEdited([
      ...edited,
      { name: newName.trim(), calories, quantity: 1, unit: newUnit, nameEdited: false, recalculating: false },
    ]);
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
        foods: edited.map((f) => ({ name: f.name, calories: f.calories, quantity: f.quantity })),
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
  const totalKcal = edited.reduce((s, f) => s + Math.round(f.calories * f.quantity), 0);

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500 px-1">끼니 기록</h2>
        {(["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as MealType[]).map((type) => (
          <MealCard
            key={type}
            type={type}
            items={meals[type]}
            imageUrl={mealImages?.[type]}
            onAdd={() => openDrawer(type)}
            onEdit={() => openEdit(type)}
          />
        ))}
      </section>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

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
                  onClick={() => setDrawer({ step: "manual", mealType: drawer.mealType, edited: [] })}
                  className="w-full border-2 border-dashed border-zinc-200 rounded-2xl py-6 flex flex-col items-center gap-2 text-zinc-500 hover:bg-zinc-50 transition-colors"
                >
                  <span className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                    <IconPencil size={20} />
                  </span>
                  <span className="text-sm font-medium">직접 입력</span>
                  <span className="text-xs text-zinc-400">음식 이름으로 검색</span>
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
                <AddRow newName={newName} setNewName={setNewName} newCalories={newCalories} setNewCalories={setNewCalories} newUnit={newUnit} setNewUnit={setNewUnit} estimating={estimating} onAdd={addManualItem} />
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
                <AddRow newName={newName} setNewName={setNewName} newCalories={newCalories} setNewCalories={setNewCalories} newUnit={newUnit} setNewUnit={setNewUnit} estimating={estimating} onAdd={addManualItem} />
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
