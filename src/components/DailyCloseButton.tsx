"use client";

import { useState } from "react";
import { IconLoader2, IconBrandThreads, IconX, IconSend, IconCheck } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generatePost, postToThreads } from "@/app/actions/threads";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
type MealItem = { name: string; calories: number };
type MealsData = Record<MealType, MealItem[]>;

type State =
  | { step: "idle" }
  | { step: "generating" }
  | { step: "preview"; text: string; photos: string[] }
  | { step: "posting" }
  | { step: "done"; permalink?: string }
  | { step: "error"; message: string };

function SortablePhoto({ url, index }: { url: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none" }}
      {...attributes}
      {...listeners}
      className={`relative shrink-0 ${isDragging ? "z-10 scale-105 shadow-lg" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover pointer-events-none" draggable={false} />
      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-semibold flex items-center justify-center">
        {index + 1}
      </span>
    </div>
  );
}

export default function DailyCloseButton({
  threadsConnected,
  meals,
  mealImages,
  totalCalories,
}: {
  threadsConnected: boolean;
  meals: MealsData;
  mealImages?: Record<MealType, string[]>;
  totalCalories: number;
}) {
  const [state, setState] = useState<State>({ step: "idle" });

  async function handleClose() {
    setState({ step: "generating" });
    try {
      const text = await generatePost(meals, totalCalories);
      const photos = mealImages ? Object.values(mealImages).flat() : [];
      setState({ step: "preview", text, photos });
    } catch (err) {
      setState({ step: "error", message: err instanceof Error ? err.message : "오류 발생" });
    }
  }

  async function handlePost(text: string, photos: string[]) {
    setState({ step: "posting" });
    const result = await postToThreads(text, photos);
    if (result.success) {
      setState({ step: "done", permalink: result.permalink });
    } else {
      setState({ step: "error", message: result.error });
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setState((s) => {
      if (s.step !== "preview") return s;
      const from = s.photos.indexOf(String(active.id));
      const to = s.photos.indexOf(String(over.id));
      if (from === -1 || to === -1) return s;
      return { ...s, photos: arrayMove(s.photos, from, to) };
    });
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
                  onChange={(e) => setState({ ...state, text: e.target.value })}
                  className="w-full bg-zinc-50 rounded-2xl p-4 text-sm text-zinc-800 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-tomato/30 min-h-[120px]"
                />
                {state.photos.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-zinc-400 mb-2">
                      함께 올라갈 사진 ({state.photos.length}장)
                      {state.photos.length > 1 && " · 꾹 눌러서 드래그로 순서 변경"}
                    </p>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={state.photos} strategy={horizontalListSortingStrategy}>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {state.photos.map((url, i) => (
                            <SortablePhoto key={url} url={url} index={i} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setState({ step: "idle" })}
                    className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-medium text-zinc-600"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handlePost(state.text, state.photos)}
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

      {/* 게시 완료 → 바로가기 */}
      {state.step === "done" && (
        <a
          href={state.permalink ?? "https://www.threads.net"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full py-3 rounded-2xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors"
        >
          <IconBrandThreads size={16} />
          게시물 확인하기
        </a>
      )}

      {/* 에러 */}
      {state.step === "error" && (
        <div className="mt-2 text-center space-y-1.5">
          <p className="text-xs text-red-500">{state.message}</p>
          {state.message.includes("재연결") && (
            <a
              href="/auth/threads"
              className="inline-block text-xs text-zinc-900 font-semibold underline underline-offset-2"
            >
              Threads 재연결하기 →
            </a>
          )}
        </div>
      )}
    </>
  );
}
