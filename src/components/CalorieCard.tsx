"use client";

import { useState } from "react";
import { IconPencil, IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { updateGoalCalories } from "@/app/actions/meal";

export default function CalorieCard({
  totalCalories,
  goalCalories,
}: {
  totalCalories: number;
  goalCalories: number;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goalCalories));
  const [saving, setSaving] = useState(false);

  const progressPct = Math.min((totalCalories / goalCalories) * 100, 100);
  const remaining = goalCalories - totalCalories;

  const parsed = parseInt(value);
  const valid = Number.isFinite(parsed) && parsed >= 500 && parsed <= 10000;

  function openEdit() {
    setValue(String(goalCalories));
    setEditing(true);
  }

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await updateGoalCalories(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-tomato rounded-2xl p-5 text-white shadow-md">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-white/70">오늘 섭취 칼로리</p>
        {!editing && (
          <button
            onClick={openEdit}
            className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center text-white/70 transition-colors"
          >
            <IconPencil size={15} />
          </button>
        )}
      </div>
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

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-white/70 shrink-0">목표</span>
          <input
            type="number"
            value={value}
            min={500}
            max={10000}
            step={50}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-24 bg-white/15 rounded-lg px-2 py-1 text-sm font-semibold text-white text-right outline-none focus:bg-white/25 placeholder:text-white/40"
          />
          <span className="text-xs text-white/70">kcal</span>
          <div className="flex-1" />
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center text-white/70"
          >
            <IconX size={15} />
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="w-7 h-7 rounded-full bg-white text-tomato flex items-center justify-center disabled:opacity-40"
          >
            {saving ? <IconLoader2 size={15} className="animate-spin" /> : <IconCheck size={15} />}
          </button>
        </div>
      ) : (
        <div className="flex justify-between mt-2 text-xs text-white/70">
          <span>목표 {goalCalories.toLocaleString()} kcal까지</span>
          <span>{remaining > 0 ? `${remaining.toLocaleString()} kcal 남음` : "목표 달성!"}</span>
        </div>
      )}
      {editing && !valid && value !== "" && (
        <p className="mt-1.5 text-[11px] text-white/60">500~10,000 사이로 입력해줘요</p>
      )}
    </div>
  );
}
