import { NextRequest, NextResponse } from "next/server";
import { generateCoachCard } from "@/lib/ai";
import { type ExperimentState } from "@/lib/dsp";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      experimentState: ExperimentState;
      learningMoments: string[];
    };

    const card = await generateCoachCard(body.experimentState, body.learningMoments);
    return NextResponse.json({ card });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成 AI 实验解读时发生未知错误。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
