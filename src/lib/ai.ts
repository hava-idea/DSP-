import OpenAI from "openai";
import { type GuidanceCard } from "@/lib/dsp";

type DashScopeChatParams = OpenAI.ChatCompletionCreateParamsNonStreaming & {
  enable_thinking?: boolean;
};

const model = process.env.DEEPSEEK_MODEL || "deepseek-v3.2";
const baseURL =
  process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const chapterTitles: Record<string, string> = {
  sampling: "采样、混叠与重建",
  dft: "DFT 与频谱分析",
  filter: "数字滤波",
  system: "离散系统响应",
};

function createClient() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error("未配置 DASHSCOPE_API_KEY。请先在 .env.local 中填写 DeepSeek API Key。");
  }

  return new OpenAI({
    apiKey,
    baseURL,
  });
}

async function createCompletion(params: DashScopeChatParams) {
  const client = createClient();
  return client.chat.completions.create(params);
}

function chapterTitle(chapterId: string) {
  return chapterTitles[chapterId] ?? "数字信号处理";
}

export async function generateChatReply(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  chapterId: string,
  context: unknown,
) {
  const title = chapterTitle(chapterId);

  const response = await createCompletion({
    model,
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          `你是数字信号处理课程《${title}》章节的 AI 助教。请用简洁、启发式、教学友好的中文回答学生问题。回答时要结合当前实验参数和实验现象，不要空泛复述教材，也不要直接代做。`,
      },
      {
        role: "system",
        content: `当前实验上下文：${JSON.stringify(context)}`,
      },
      ...messages,
    ],
    enable_thinking: false,
  });

  return response.choices[0]?.message?.content ?? "暂时没有生成回复。";
}

export async function generateCoachCard(
  chapterId: string,
  context: unknown,
  learningMoments: string[],
) {
  const title = chapterTitle(chapterId);

  const response = await createCompletion({
    model,
    temperature: 0.4,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content:
          `你是数字信号处理课程《${title}》的实验教练。请根据当前实验参数返回 JSON。字段必须是 title, summary, observations, nextStep。observations 必须是字符串数组。summary 要解释当前现象，nextStep 要给出下一步实验建议。JSON。`,
      },
      {
        role: "user",
        content: JSON.stringify({
          context,
          learningMoments,
        }),
      },
    ],
    enable_thinking: false,
  });

  return parseGuidanceCard(response.choices[0]?.message?.content);
}

export async function generateEvaluationCard(chapterId: string, context: unknown) {
  const title = chapterTitle(chapterId);

  const response = await createCompletion({
    model,
    temperature: 0.3,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content:
          `你是数字信号处理课程《${title}》的学习评价助手。请输出 JSON，字段必须是 title, summary, observations, nextStep。observations 必须是字符串数组。评价要体现过程性学习分析，而不是只给结论。JSON。`,
      },
      {
        role: "user",
        content: JSON.stringify({ context }),
      },
    ],
    enable_thinking: true,
  });

  return parseGuidanceCard(response.choices[0]?.message?.content);
}

function parseGuidanceCard(rawContent: string | null | undefined): GuidanceCard {
  if (!rawContent) {
    return {
      title: "AI 返回为空",
      summary: "模型暂时没有生成可用内容。",
      observations: ["请检查模型权限、API Key 和网络连接。"],
      nextStep: "稍后重新尝试。",
    };
  }

  try {
    const parsed = JSON.parse(rawContent) as Partial<GuidanceCard>;
    return {
      title: parsed.title ?? "AI 分析结果",
      summary: parsed.summary ?? "未提供摘要。",
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.map(String)
        : ["未提供观察点。"],
      nextStep: parsed.nextStep ?? "继续调整参数并观察变化。",
    };
  } catch {
    return {
      title: "AI 结果已返回",
      summary: rawContent,
      observations: ["模型返回了非 JSON 内容，已按文本回退显示。"],
      nextStep: "如果需要稳定卡片数据，可以进一步收紧提示词。",
    };
  }
}
