"use client";

import { useState } from "react";
import { IconLoader2, IconBrandThreads, IconX, IconSend, IconCheck } from "@tabler/icons-react";
import { generatePost, postToThreads } from "@/app/actions/threads";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type MealItem = { name: string; calories: number };
type MealsData = Record<MealType, MealItem[]>;

type State =
  | { step: "idle" }
  | { step: "generating" }
  | { step: "preview"; text: string }
  | { step: "posting" }
  | { step: "done" }
  | { step: "error"; message: string };

export default function DailyCloseButton({
  threadsConnected,
  meals,
  totalCalories,
}: {
  threadsConnected: boolean;
  meals: MealsData;
  totalCalories: number;
}) {
  const [state, setState] = useState<State>({ step: "idle" });

  async function handleClose() {
    setState({ step: "generating" });
    try {
      const text = await generatePost(meals, totalCalories);
      setState({ step: "preview", text });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "오류 발생" });
    }
  }

  async function handlePost(text: string) {
    setState({ step: "posting" });
    try {
      await postToThreads(text);
      setState({ step: "done" });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "발행 실패" });
    }
  }

  if (!threadsConnected) {
    return (
      <a
        href="/auth/threads"
        className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-semibold rounded-2xl py-4 flex items-center justify-center gap-2.5 transition-colors shadow-lg"
      >
        <IconBrandThreads size={20} />
        <span>Threads 연결하고 올리기</span>
      </a>
    );
  }

  return (
    <>
      <button
        onClick={handleClose}
        disabled={state.step === "generating" || state.step === "posting"}
        className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:opacity-60 text-white font-semibold rounded-2xl py-4 flex items-center justify-center gap-2.5 transition-colors shadow-lg"
      >
        {state.step === "generating" ? (
          <>
            <IconLoader2 size={20} className="animate-spin" />
            <span>AI가 글 쓰는 중...</span>
          </>
        ) : state.step === "done" ? (
          <>
            <IconCheck size={20} />
            <span>Threads에 올렸어요!</span>
          </>
        ) : (
          <>
            <span className="text-lg">🍅</span>
            <span>오늘 마감하고 Threads에 올리기</span>
          </>
        )}
      </button>

      {/* 미리보기 모달 */}
      {(state.step === "preview" || state.step === "posting") && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => state.step === "preview" && setState({ step: "idle" })}
          />
          <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-zinc-900">Threads 미리보기</h3>
              {state.step === "preview" && (
                <button
                  onClick={() => setState({ step: "idle" })}
                  className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400"
                >
                  <IconX size={18} />
                </button>
              )}
            </div>

            {state.step === "preview" && (
              <>
                <textarea
                  value={state.text}
                  onChange={(e) => setState({ step: "preview", text: e.target.value })}
                  className="w-full bg-zinc-50 rounded-2xl p-4 text-sm text-zinc-800 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-tomato/30 min-h-[120px]"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setState({ step: "idle" })}
                    className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-medium text-zinc-600"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handlePost(state.text)}
                    className="flex-1 py-3 rounded-2xl bg-zinc-900 text-white text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    <IconSend size={15} />
                    올리기
                  </button>
                </div>
              </>
            )}

            {state.step === "posting" && (
              <div className="flex flex-col items-center gap-3 py-6">
                <IconLoader2 size={28} className="animate-spin text-zinc-800" />
                <span className="text-sm text-zinc-500">Threads에 올리는 중...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 에러 */}
      {state.step === "error" && (
        <p className="text-xs text-red-500 text-center mt-2">{state.message}</p>
      )}
    </>
  );
}
