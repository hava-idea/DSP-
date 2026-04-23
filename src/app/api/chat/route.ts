import { NextRequest, NextResponse } from "next/server";
import { generateChatReply } from "@/lib/ai";
import { type ChatMessage, type ExperimentState } from "@/lib/dsp";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages: ChatMessage[];
      experimentState: ExperimentState;
    };

    const content = await generateChatReply(body.messages, body.experimentState);
    return NextResponse.json({ content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "调用 DeepSeek 接口时发生未知错误。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
