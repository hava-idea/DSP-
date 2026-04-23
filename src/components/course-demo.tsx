"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import {
  createDefaultExperimentState,
  createSpectrumAnalysis,
  describeSamplingStatus,
  formatChartPoints,
  generateContinuousWave,
  generateReconstructedWave,
  generateSampledWave,
  generateStudentJourney,
  type ChapterCard,
  type ChatMessage,
  type ExperimentState,
  type GuidanceCard,
  type SpectrumAnalysis,
} from "@/lib/dsp";

const chapterCards: ChapterCard[] = [
  {
    id: "sampling",
    title: "采样、混叠与重建",
    status: "当前主场景",
    description: "用一个高反馈实验页面，让学生同时看到原始信号、采样点和重建结果。",
  },
  {
    id: "system",
    title: "信号与系统",
    status: "预留入口",
    description: "后续可扩展系统响应动画、卷积可视化与 AI 错因讲解。",
  },
  {
    id: "dft",
    title: "DFT 与频谱分析",
    status: "预留入口",
    description: "后续可增加窗函数、频谱泄漏与 FFT 互动实验。",
  },
  {
    id: "filter",
    title: "数字滤波",
    status: "预留入口",
    description: "后续可接入滤波器设计、降噪实验和过程评价。",
  },
];

const quickPrompts = [
  "为什么采样率接近信号频率时会产生低频错觉？",
  "请根据当前参数解释一下混叠现象。",
  "如果我要减少失真，应该先调采样率还是振幅？",
];

const fallbackGuide: GuidanceCard = {
  title: "等待 AI 解读",
  summary: "点击按钮后，系统会根据当前实验参数生成面向学生的实验分析。",
  observations: ["先观察采样点的密度变化。", "再对比真实频率与混叠频率是否一致。"],
  nextStep: "尝试把采样率继续降低，再判断重建曲线发生了什么变化。",
};

const mobileTabs = [
  { id: "overview", label: "总览" },
  { id: "experiment", label: "实验" },
  { id: "assistant", label: "助教" },
  { id: "evaluate", label: "评价" },
] as const;

const domainTabs = [
  { id: "time", label: "时域" },
  { id: "frequency", label: "频域" },
] as const;

type MobileTab = (typeof mobileTabs)[number]["id"];
type DomainView = (typeof domainTabs)[number]["id"];

type ApiResponse = {
  content?: string;
  card?: GuidanceCard;
  error?: string;
};

export function CourseDemo() {
  const [experimentState, setExperimentState] = useState<ExperimentState>(
    createDefaultExperimentState(),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "欢迎来到《采样、混叠与重建》互动章节。你可以拖动参数，观察波形、采样点、频谱和重建趋势，我会结合当前实验状态进行讲解。",
    },
  ]);
  const [input, setInput] = useState("");
  const [coachCard, setCoachCard] = useState<GuidanceCard>(fallbackGuide);
  const [evaluation, setEvaluation] = useState<GuidanceCard | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");

  const samplingStatus = useMemo(
    () => describeSamplingStatus(experimentState),
    [experimentState],
  );
  const analogWave = useMemo(
    () => generateContinuousWave(experimentState),
    [experimentState],
  );
  const reconstructedWave = useMemo(
    () => generateReconstructedWave(experimentState),
    [experimentState],
  );
  const sampledWave = useMemo(
    () => generateSampledWave(experimentState),
    [experimentState],
  );
  const spectrum = useMemo(
    () => createSpectrumAnalysis(experimentState),
    [experimentState],
  );
  const journey = useMemo(
    () => generateStudentJourney(experimentState),
    [experimentState],
  );

  const visibleWindow = `${Math.round(experimentState.duration * 1000)} ms`;
  const displayedSamples = sampledWave.length;

  function updateExperimentState(patch: Partial<ExperimentState>) {
    setExperimentState((current) => ({ ...current, ...patch }));
    setEvaluation(null);
  }

  async function sendMessage(prompt: string) {
    const trimmed = prompt.trim();
    if (isChatLoading || !trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          experimentState,
        }),
      });

      const data = (await response.json()) as ApiResponse;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.content ??
            data.error ??
            "模型暂时没有返回结果，请检查 API Key、模型权限和网络连接。",
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "请求失败，请稍后重试。";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `AI 助教暂时离线：${message}`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }

  async function requestCoach() {
    if (isCoachLoading) {
      return;
    }

    setIsCoachLoading(true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          experimentState,
          learningMoments: ["AI 导学", "AI 伴学", "AI 评学"],
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (data.card) {
        setCoachCard(data.card);
      } else {
        setCoachCard({
          title: "AI 解读暂不可用",
          summary: data.error ?? "暂时无法生成实验解读。",
          observations: fallbackGuide.observations,
          nextStep: fallbackGuide.nextStep,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "暂时无法生成实验解读。";
      setCoachCard({
        title: "AI 解读暂不可用",
        summary: message,
        observations: fallbackGuide.observations,
        nextStep: fallbackGuide.nextStep,
      });
    } finally {
      setIsCoachLoading(false);
    }
  }

  async function requestEvaluation() {
    if (isEvaluationLoading) {
      return;
    }

    setIsEvaluationLoading(true);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          experimentState,
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (data.card) {
        setEvaluation(data.card);
      } else {
        setEvaluation({
          title: "学习评价暂不可用",
          summary: data.error ?? "暂时无法生成学习评价。",
          observations: journey.highlights,
          nextStep: journey.recommendedAction,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "暂时无法生成学习评价。";
      setEvaluation({
        title: "学习评价暂不可用",
        summary: message,
        observations: journey.highlights,
        nextStep: journey.recommendedAction,
      });
    } finally {
      setIsEvaluationLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    setInput("");
    void sendMessage(trimmed);
  }

  function handleMobileTabChange(tab: MobileTab) {
    if (tab === mobileTab) {
      return;
    }

    setMobileTab(tab);

    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      try {
        window.scrollTo({ top: 0 });
      } catch {
        window.scrollTo(0, 0);
      }
    }, 0);
  }

  const experimentPanel = (
    <ExperimentPanel
      experimentState={experimentState}
      samplingStatus={samplingStatus}
      analogWave={analogWave}
      reconstructedWave={reconstructedWave}
      sampledWave={sampledWave}
      spectrum={spectrum}
      visibleWindow={visibleWindow}
      displayedSamples={displayedSamples}
      onUpdate={updateExperimentState}
    />
  );

  const coachPanel = (
    <CoachPanel
      coachCard={coachCard}
      isCoachLoading={isCoachLoading}
      onRequestCoach={requestCoach}
    />
  );

  const assistantPanel = (
    <AssistantPanel
      quickPrompts={quickPrompts}
      messages={messages}
      input={input}
      isChatLoading={isChatLoading}
      onInputChange={setInput}
      onSendPrompt={sendMessage}
      onSubmit={handleSubmit}
    />
  );

  const evaluationPanel = (
    <EvaluationPanel
      journey={journey}
      evaluation={evaluation}
      isEvaluationLoading={isEvaluationLoading}
      onRequestEvaluation={requestEvaluation}
    />
  );

  return (
    <main className="min-h-screen px-4 py-4 pb-28 lg:px-6 lg:py-6 lg:pb-6">
      <div className="mx-auto max-w-[1480px] space-y-6">
        {mobileTab === "overview" ? (
          <div className="lg:hidden">
            <ChapterLayoutSection chapterCards={chapterCards} />
          </div>
        ) : null}

        <div className="hidden lg:block">
          <ChapterLayoutSection chapterCards={chapterCards} />
        </div>

        <div className="space-y-6 lg:hidden">
          {mobileTab === "experiment" ? (
            <>
              {experimentPanel}
              {coachPanel}
            </>
          ) : null}

          {mobileTab === "assistant" ? assistantPanel : null}
          {mobileTab === "evaluate" ? evaluationPanel : null}
        </div>

        <section className="hidden space-y-6 lg:block">
          {experimentPanel}
          {coachPanel}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            {assistantPanel}
            {evaluationPanel}
          </div>
        </section>
      </div>

      <MobileBottomNav activeTab={mobileTab} onChange={handleMobileTabChange} />
    </main>
  );
}
function ChapterLayoutSection({
  chapterCards,
}: {
  chapterCards: ChapterCard[];
}) {
  return (
    <section className="apple-card rounded-[36px] p-5 lg:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
            数字信号处理
          </h1>
          <AcademyIdentityCard />
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="grid min-w-max gap-4 px-1 md:grid-cols-2 xl:min-w-0 xl:grid-cols-4">
            {chapterCards.map((chapter) => (
              <article
                key={chapter.id}
                className={`rounded-[28px] border p-5 transition ${
                  chapter.id === "sampling"
                    ? "border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-[0_14px_30px_rgba(37,99,235,0.08)]"
                    : "border-white/60 bg-white/68"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-950">{chapter.title}</h3>
                  <span className="soft-pill rounded-full px-3 py-1 text-xs font-medium text-slate-600">
                    {chapter.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{chapter.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExperimentPanel({
  experimentState,
  samplingStatus,
  analogWave,
  reconstructedWave,
  sampledWave,
  spectrum,
  visibleWindow,
  displayedSamples,
  onUpdate,
}: {
  experimentState: ExperimentState;
  samplingStatus: ReturnType<typeof describeSamplingStatus>;
  analogWave: Array<{ x: number; y: number }>;
  reconstructedWave: Array<{ x: number; y: number }>;
  sampledWave: Array<{ x: number; y: number }>;
  spectrum: SpectrumAnalysis;
  visibleWindow: string;
  displayedSamples: number;
  onUpdate: (patch: Partial<ExperimentState>) => void;
}) {
  const [activeDomain, setActiveDomain] = useState<DomainView>("time");

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <SectionTitle eyebrow="互动实验区" title="一屏联动波形、采样点、频谱与重建趋势" />
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            这版图形使用固定纵轴和更短的时间窗，振幅、频率、采样率和相位一调整都会立刻反映到图上，更适合现场演示。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusPill label="当前状态" value={samplingStatus.label} tone={samplingStatus.tone} />
          <StatusPill
            label="Nyquist"
            value={samplingStatus.nyquistSatisfied ? "已满足" : "未满足"}
            tone={samplingStatus.nyquistSatisfied ? "safe" : "risk"}
          />
          <StatusPill
            label="混叠频率"
            value={`${samplingStatus.aliasFrequency.toFixed(2)} Hz`}
            tone="accent"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {domainTabs.map((tab) => {
                const active = tab.id === activeDomain;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDomain(tab.id)}
                    aria-pressed={active}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <MiniMetric label="采样率" value={`${experimentState.samplingRate.toFixed(1)} Hz`} />
              <MiniMetric label="原始频率" value={`${experimentState.signalFrequency.toFixed(1)} Hz`} />
              <MiniMetric label="混叠频率" value={`${samplingStatus.aliasFrequency.toFixed(2)} Hz`} />
            </div>
          </div>

          {activeDomain === "time" ? (
            <WavePanel
              analogWave={analogWave}
              reconstructedWave={reconstructedWave}
              sampledWave={sampledWave}
              windowLabel={visibleWindow}
            />
          ) : (
            <SpectrumPanel spectrum={spectrum} samplingRate={experimentState.samplingRate} />
          )}
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <MiniMetric label="可视时间窗" value={visibleWindow} />
            <MiniMetric label="显示采样点" value={`${displayedSamples}`} />
            <MiniMetric label="原始频率" value={`${experimentState.signalFrequency.toFixed(1)} Hz`} />
          </div>

          <div className="mt-5 space-y-4">
            <SliderField
              label="信号频率"
              value={experimentState.signalFrequency}
              min={1}
              max={30}
              step={0.5}
              unit="Hz"
              onChange={(value) => onUpdate({ signalFrequency: value })}
            />
            <SliderField
              label="采样率"
              value={experimentState.samplingRate}
              min={4}
              max={60}
              step={1}
              unit="Hz"
              onChange={(value) => onUpdate({ samplingRate: value })}
            />
            <SliderField
              label="振幅"
              value={experimentState.amplitude}
              min={0.4}
              max={2}
              step={0.1}
              unit=""
              onChange={(value) => onUpdate({ amplitude: value })}
            />
            <SliderField
              label="相位"
              value={experimentState.phase}
              min={0}
              max={3.14}
              step={0.1}
              unit="rad"
              onChange={(value) => onUpdate({ phase: value })}
            />
            <SliderField
              label="噪声强度"
              value={experimentState.noiseLevel}
              min={0}
              max={0.4}
              step={0.02}
              unit=""
              onChange={(value) => onUpdate({ noiseLevel: value })}
            />
          </div>

          <div className="mt-5 rounded-[26px] bg-slate-50/90 p-4">
            <h4 className="text-sm font-semibold text-slate-950">即时观察摘要</h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {samplingStatus.observations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}
function CoachPanel({
  coachCard,
  isCoachLoading,
  onRequestCoach,
}: {
  coachCard: GuidanceCard;
  isCoachLoading: boolean;
  onRequestCoach: () => Promise<void>;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <SectionTitle eyebrow="AI 实验解读" title="把参数变化即时翻译成学生能理解的说明" />
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            这个卡片不是固定文案，而是会把你当前设置的采样率、频率和观测结果发送给模型，再返回更贴合现场实验状态的解读。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRequestCoach()}
          disabled={isCoachLoading}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCoachLoading ? "AI 正在分析..." : "生成 AI 实验解读"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <InsightCard title={coachCard.title} emphasis>
          <p>{coachCard.summary}</p>
        </InsightCard>
        <InsightCard title="下一步建议">
          <p>{coachCard.nextStep}</p>
        </InsightCard>
      </div>

      <div className="mt-4 rounded-[28px] bg-slate-50/90 p-4">
        <p className="text-sm font-semibold text-slate-950">关键现象</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {coachCard.observations.map((item) => (
            <div
              key={item}
              className="rounded-[22px] bg-white/92 p-3 text-sm leading-6 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function AssistantPanel({
  quickPrompts,
  messages,
  input,
  isChatLoading,
  onInputChange,
  onSendPrompt,
  onSubmit,
}: {
  quickPrompts: string[];
  messages: ChatMessage[];
  input: string;
  isChatLoading: boolean;
  onInputChange: (value: string) => void;
  onSendPrompt: (prompt: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Panel className="flex min-h-[780px] flex-col">
      <SectionTitle eyebrow="AI 学习助手" title="对话式答疑与追问" />
      <div className="mt-4 flex flex-wrap gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void onSendPrompt(prompt)}
            disabled={isChatLoading}
            className="soft-pill rounded-full px-3 py-2 text-left text-xs font-medium leading-5 text-slate-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-5 flex-1 overflow-y-auto rounded-[30px] bg-[linear-gradient(180deg,#f9fbff_0%,#f1f5fb_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-[24px] px-4 py-3 text-sm leading-7 ${
                message.role === "assistant"
                  ? "mr-8 bg-white text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.06)]"
                  : "ml-8 bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
              }`}
            >
              {message.content}
            </div>
          ))}
          {isChatLoading ? (
            <div className="mr-8 rounded-[24px] bg-white px-4 py-3 text-sm text-slate-500 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
              AI 助教正在结合当前实验状态生成回答...
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          rows={4}
          placeholder="比如：为什么我把采样率设为 20 Hz 后，看到的波形像 2 Hz 的低频信号？"
          className="w-full rounded-[26px] border border-white/80 bg-white/78 px-4 py-3 text-sm leading-6 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={isChatLoading}
          className="w-full rounded-[22px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isChatLoading ? "发送中..." : "发送给 AI 助教"}
        </button>
      </form>
    </Panel>
  );
}

function EvaluationPanel({
  journey,
  evaluation,
  isEvaluationLoading,
  onRequestEvaluation,
}: {
  journey: ReturnType<typeof generateStudentJourney>;
  evaluation: GuidanceCard | null;
  isEvaluationLoading: boolean;
  onRequestEvaluation: () => Promise<void>;
}) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <SectionTitle eyebrow="过程评价" title="学习轨迹与智能诊断" />
          <p className="text-sm leading-7 text-slate-600">
            点击按钮后，系统会根据当前实验状态和本轮操作轨迹生成过程性评价，而不是只看答对或答错。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRequestEvaluation()}
          disabled={isEvaluationLoading}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEvaluationLoading ? "AI 生成中..." : "生成评价"}
        </button>
      </div>

      <div className="mt-5 rounded-[28px] bg-slate-50/90 p-4">
        <p className="text-sm font-semibold text-slate-950">当前学习轨迹</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {journey.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {evaluation ? (
        <div className="mt-4 rounded-[28px] bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
          <h3 className="text-lg font-semibold">{evaluation.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-200">{evaluation.summary}</p>
          <div className="mt-4 space-y-2 text-sm leading-6 text-slate-200">
            {evaluation.observations.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          <div className="mt-4 rounded-[20px] bg-white/10 px-4 py-3 text-sm text-slate-100">
            下一步：{evaluation.nextStep}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[28px] border border-dashed border-slate-200 bg-white/62 px-4 py-6 text-sm leading-7 text-slate-500">
          这里会显示 AI 根据本轮操作自动生成的学习评价与下一步建议。
        </div>
      )}
    </Panel>
  );
}

function MobileBottomNav({
  activeTab,
  onChange,
}: {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  return (
    <nav
      aria-label="移动端页面切换"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 lg:hidden"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <div className="mx-auto flex max-w-[520px] items-center justify-between rounded-[28px] border border-white/80 bg-white/92 px-3 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        {mobileTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 touch-manipulation select-none flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
                  : "text-slate-500"
              }`}
            >
              <span
                className={`h-1.5 w-6 rounded-full ${
                  active ? "bg-white" : "bg-slate-300"
                }`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`apple-card rounded-[34px] p-5 lg:p-6 ${className}`}>{children}</section>;
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
    </div>
  );
}

function AcademyIdentityCard() {
  return (
    <div className="w-16 shrink-0 overflow-hidden rounded-[18px] border border-white/90 bg-white/88 p-1 shadow-[0_12px_28px_rgba(37,99,235,0.12)] lg:w-20">
      <Image
        src="/academy-seal.jpg"
        alt="天津大学电气自动化与信息工程学院院标"
        width={80}
        height={80}
        className="h-auto w-full rounded-[14px]"
      />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "safe" | "risk" | "accent";
}) {
  const toneMap = {
    safe: "border-emerald-200 bg-emerald-50 text-emerald-700",
    risk: "border-orange-200 bg-orange-50 text-orange-700",
    accent: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`rounded-full border px-4 py-2 text-sm font-medium ${toneMap[tone]}`}>
      <span className="text-slate-500">{label}：</span>
      {value}
    </div>
  );
}

function WavePanel({
  analogWave,
  reconstructedWave,
  sampledWave,
  windowLabel,
}: {
  analogWave: Array<{ x: number; y: number }>;
  reconstructedWave: Array<{ x: number; y: number }>;
  sampledWave: Array<{ x: number; y: number }>;
  windowLabel: string;
}) {
  const analogPath = formatChartPoints(analogWave);
  const reconstructedPath = formatChartPoints(reconstructedWave);

  return (
    <div className="rounded-[30px] bg-[linear-gradient(180deg,#1f355f_0%,#10223f_100%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">时域观察</h3>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            蓝线是连续信号，金色采样点会随采样率改变，虚线显示当前重建趋势。
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-slate-200">
          可视时间窗 {windowLabel}
        </span>
      </div>
      <svg viewBox="0 0 960 420" className="h-[320px] w-full rounded-[24px] bg-[#10223f]">
        <defs>
          <linearGradient id="analogLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="reconstructLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="960" height="420" rx="24" fill="#10223f" />
        {Array.from({ length: 7 }).map((_, index) => {
          const y = 60 + index * 50;
          return <line key={y} x1="44" y1={y} x2="916" y2={y} stroke="#274067" strokeWidth="1" />;
        })}
        {Array.from({ length: 10 }).map((_, index) => {
          const x = 44 + index * 87.2;
          return <line key={x} x1={x} y1="40" x2={x} y2="380" stroke="#274067" strokeWidth="1" />;
        })}
        <line x1="44" y1="210" x2="916" y2="210" stroke="#55739f" strokeWidth="1.5" />
        <path d={analogPath} fill="none" stroke="url(#analogLine)" strokeWidth="4" />
        <path
          d={reconstructedPath}
          fill="none"
          stroke="url(#reconstructLine)"
          strokeWidth="3"
          strokeDasharray="12 10"
        />
        {sampledWave.map((point) => (
          <circle
            key={`${point.x}-${point.y}`}
            cx={point.x}
            cy={point.y}
            r="6.5"
            fill="#fcd34d"
            stroke="#fff6d6"
          />
        ))}
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
        <LegendDot color="bg-sky-300" label="连续信号" />
        <LegendDot color="bg-amber-300" label="采样点" />
        <LegendDot color="bg-orange-400" label="重建趋势" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function SpectrumPanel({
  spectrum,
  samplingRate,
}: {
  spectrum: SpectrumAnalysis;
  samplingRate: number;
}) {
  return (
    <div className="rounded-[30px] bg-white/82 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">频谱观察</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            原始频率、Nyquist 边界、混叠频率和采样率会同时标出，方便学生建立对应关系。
          </p>
        </div>
        <span className="soft-pill rounded-full px-4 py-2 text-sm font-medium text-slate-600">
          fs = {samplingRate.toFixed(1)} Hz
        </span>
      </div>

      <svg viewBox="0 0 960 240" className="mt-5 h-[320px] w-full rounded-[24px] bg-slate-50">
        <rect x="0" y="0" width="960" height="240" rx="24" fill="#f8fafc" />
        <line x1="70" y1="192" x2="890" y2="192" stroke="#cbd5e1" strokeWidth="2" />
        {spectrum.ticks.map((tick) => {
          const x = 70 + (tick / spectrum.axisMax) * 820;
          return (
            <g key={tick}>
              <line x1={x} y1="42" x2={x} y2="192" stroke="#dbe4ef" strokeWidth="1" />
              <text x={x} y="214" textAnchor="middle" fill="#64748b" fontSize="12">
                {tick}
              </text>
            </g>
          );
        })}
        {spectrum.markers.map((marker) => (
          <g key={`${marker.label}-${marker.color}`}>
            <line
              x1={marker.x}
              y1="192"
              x2={marker.x}
              y2={marker.y}
              stroke={marker.color}
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle cx={marker.x} cy={marker.y} r="8" fill={marker.color} />
            <text x={marker.x} y={marker.y - 16} textAnchor="middle" fill="#0f172a" fontSize="12">
              {marker.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
        <LegendDot color="bg-blue-600" label="原始频率" />
        <LegendDot color="bg-amber-400" label="Nyquist" />
        <LegendDot color="bg-orange-500" label="混叠频率" />
        <LegendDot color="bg-slate-900" label="采样率" />
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const decimals = step >= 1 ? 0 : 2;

  function clampValue(nextValue: number) {
    if (!Number.isFinite(nextValue)) {
      return value;
    }

    return Math.min(max, Math.max(min, nextValue));
  }

  return (
    <label className="block rounded-[24px] bg-slate-50/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value.toFixed(decimals)}
            onChange={(event) => onChange(clampValue(event.currentTarget.valueAsNumber))}
            className="w-24 rounded-full border border-slate-200 bg-white px-3 py-1 text-right text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
          />
          <span className="soft-pill rounded-full px-3 py-1 text-xs font-semibold text-slate-700">
            {unit || "值"}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onInput={(event) => onChange(Number((event.target as HTMLInputElement).value))}
        className="h-2 w-full cursor-pointer accent-blue-600"
      />
    </label>
  );
}

function InsightCard({
  title,
  children,
  emphasis = false,
}: {
  title: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-[28px] p-4 text-sm leading-7 ${
        emphasis
          ? "bg-gradient-to-br from-slate-950 to-slate-800 text-white"
          : "bg-slate-50/90 text-slate-600"
      }`}
    >
      <h3 className={`text-base font-semibold ${emphasis ? "text-white" : "text-slate-950"}`}>
        {title}
      </h3>
      <div className={`mt-3 ${emphasis ? "text-slate-200" : "text-slate-600"}`}>{children}</div>
    </div>
  );
}
