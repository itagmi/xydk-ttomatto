import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const imageFile = formData.get("image") as File | null;

  if (!imageFile) {
    return Response.json({ error: "이미지가 없습니다" }, { status: 400 });
  }

  const bytes = await imageFile.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = (
    imageFile.type?.startsWith("image/") ? imageFile.type : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  // Blob에 사진 저장
  let imageUrl: string | undefined;
  try {
    const ext = mediaType.split("/")[1] ?? "jpg";
    const blob = await put(`meals/${user.id}/${Date.now()}.${ext}`, Buffer.from(bytes), {
      access: "public",
      contentType: mediaType,
    });
    imageUrl = blob.url;
  } catch (err) {
    // 업로드 실패해도 분석은 계속
    console.error("[analyze-meal] blob upload failed:", err);
  }

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `이 음식 사진을 분석해서 음식 항목과 예상 칼로리를 알려줘. 반드시 다음 JSON 형식으로만 응답해:
{
  "foods": [
    {"name": "음식명", "calories": 숫자}
  ],
  "totalCalories": 숫자
}
각 음식의 1인분 기준 칼로리를 추정해. 보이는 음식만 포함하고, 다른 텍스트 없이 JSON만 출력해.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "AI 응답을 받지 못했습니다" }, { status: 500 });
  }

  try {
    const match = textBlock.text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(match ? match[0] : textBlock.text);
    return Response.json({ ...result, imageUrl });
  } catch {
    return Response.json({ error: "AI 응답 형식 오류" }, { status: 500 });
  }
}
