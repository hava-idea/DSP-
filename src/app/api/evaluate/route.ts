import { NextRequest, NextResponse } from "next/server";
import { generateEvaluationCard } from "@/lib/ai";
import { type ExperimentState } from "@/lib/dsp";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      experimentState: ExperimentState;
    };

    const card = await generateEvaluationCard(body.experimentState);
    return NextResponse.json({ card });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "生成学习评价时发生未知错误。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
