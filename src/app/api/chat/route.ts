import { NextRequest, NextResponse } from "next/server";
import { generateChatReply } from "@/lib/ai";
import { type ChatMessage } from "@/lib/dsp";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      chapterId: string;
      messages: ChatMessage[];
      context: unknown;
    };

    const content = await generateChatReply(body.messages, body.chapterId, body.context);
    return NextResponse.json({ content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "调用 DeepSeek 接口时发生未知错误。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
