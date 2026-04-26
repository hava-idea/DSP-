"use client";

import Image from "next/image";
import Link from "next/link";
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
    status: "已上线",
    description: "拖动参数，观察采样点如何改变波形、频谱与重建结果。",
  },
  {
    id: "system",
    title: "离散系统响应",
    status: "已上线",
    description: "输入输出、冲激响应与系统特性联动观察。",
  },
  {
    id: "dft",
    title: "DFT 与频谱分析",
    status: "已上线",
    description: "双频信号、窗函数与离散频谱联动观察。",
  },
  {
    id: "filter",
    title: "数字滤波",
    status: "已上线",
    description: "输入输出波形、频域抑制与截止频率互动实验。",
  },
];

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
const samplingDomainTabs = [
  { id: "time", label: "时域" },
  { id: "frequency", label: "频域" },
  { id: "sampling-frequency", label: "频域采样" },
] as const;

type MobileTab = (typeof mobileTabs)[number]["id"];
type DomainView = (typeof domainTabs)[number]["id"];
type SamplingDomainView = (typeof samplingDomainTabs)[number]["id"];
type ChapterId = "sampling" | "system" | "dft" | "filter";
type DftState = {
  windowMode: "rect" | "hann";
  primaryFrequency: number;
  secondaryFrequency: number;
  secondaryAmplitude: number;
  fftSize: number;
};
type FilterState = {
  filterMode: "lowpass" | "highpass";
  cutoffFrequency: number;
  interferenceFrequency: number;
  interferenceLevel: number;
  responseSharpness: number;
};
type SystemState = {
  inputType: "step" | "pulse" | "sine";
  systemMode: "smoothing" | "difference" | "delay";
  inputAmplitude: number;
  inputFrequency: number;
  gain: number;
  delaySamples: number;
};
type SystemAnalysis = {
  inputSamples: number[];
  outputSamples: number[];
  inputPoints: Array<{ x: number; y: number }>;
  outputPoints: Array<{ x: number; y: number }>;
  responseCurve: Array<{ x: number; y: number }>;
  outputPeak: number;
  responseTrait: string;
};
type ChapterJourney = {
  highlights: string[];
  recommendedAction: string;
};

type ApiResponse = {
  content?: string;
  card?: GuidanceCard;
  error?: string;
};

const chapterQuickPrompts: Record<ChapterId, string[]> = {
  sampling: [
    "为什么采样率接近信号频率时会产生低频错觉？",
    "请根据当前参数解释一下混叠现象。",
    "如果我要减少失真，应该先调采样率还是振幅？",
  ],
  dft: [
    "为什么换成 Hann 窗后频谱旁瓣变少了？",
    "DFT 点数增加后，我看到的频谱变化说明了什么？",
    "两个频率靠近时，怎么判断有没有频谱泄漏？",
  ],
  filter: [
    "为什么截止频率变化后输出波形会更平滑或更尖锐？",
    "当前低通或高通设置主要抑制了哪一部分频率？",
    "如果我要保留有效信号同时压低干扰，应该优先调什么？",
  ],
  system: [
    "为什么这个系统会让输出变平滑或变尖锐？",
    "延时样本数变化后，输入输出之间的关系说明了什么？",
    "当前系统更像低通、高通还是纯延时？",
  ],
};

const chapterAssistantOpeners: Record<ChapterId, string> = {
  sampling:
    "欢迎来到《采样、混叠与重建》互动章节。你可以拖动参数，观察波形、采样点、频谱和重建趋势，我会结合当前实验状态进行讲解。",
  dft:
    "欢迎来到《DFT 与频谱分析》互动章节。你可以切换窗函数、调整双频参数和 DFT 点数，我会结合当前频谱现象给出解释。",
  filter:
    "欢迎来到《数字滤波》互动章节。你可以切换低通或高通、调整截止频率与干扰强度，我会结合当前输入输出变化来解读。",
  system:
    "欢迎来到《离散系统响应》互动章节。你可以切换输入信号和系统类型，观察输出响应与系统特性的变化。",
};
const chapterInputPlaceholders: Record<ChapterId, string> = {
  sampling: "比如：为什么我把采样率设为 20 Hz 后，看到的波形像 2 Hz 的低频信号？",
  dft: "比如：为什么换成 Hann 窗后，主峰周围的泄漏看起来变少了？",
  filter: "比如：为什么我降低截止频率后，输出波形变得更平滑了？",
  system: "比如：为什么平滑系统会让输出看起来更滞后？",
};

export function CourseDemo() {
  const [experimentState, setExperimentState] = useState<ExperimentState>(
    createDefaultExperimentState(),
  );
  const [dftState, setDftState] = useState<DftState>({
    windowMode: "hann",
    primaryFrequency: 12,
    secondaryFrequency: 26,
    secondaryAmplitude: 0.7,
    fftSize: 64,
  });
  const [filterState, setFilterState] = useState<FilterState>({
    filterMode: "lowpass",
    cutoffFrequency: 12,
    interferenceFrequency: 28,
    interferenceLevel: 0.8,
    responseSharpness: 1.2,
  });
  const [systemState, setSystemState] = useState<SystemState>({
    inputType: "step",
    systemMode: "smoothing",
    inputAmplitude: 1,
    inputFrequency: 3,
    gain: 1,
    delaySamples: 4,
  });
  const [messagesByChapter, setMessagesByChapter] = useState<Record<ChapterId, ChatMessage[]>>({
    sampling: [{ role: "assistant", content: chapterAssistantOpeners.sampling }],
    dft: [{ role: "assistant", content: chapterAssistantOpeners.dft }],
    filter: [{ role: "assistant", content: chapterAssistantOpeners.filter }],
    system: [{ role: "assistant", content: chapterAssistantOpeners.system }],
  });
  const [input, setInput] = useState("");
  const [coachCards, setCoachCards] = useState<Record<ChapterId, GuidanceCard | null>>({
    sampling: null,
    dft: null,
    filter: null,
    system: null,
  });
  const [evaluations, setEvaluations] = useState<Record<ChapterId, GuidanceCard | null>>({
    sampling: null,
    dft: null,
    filter: null,
    system: null,
  });
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");
  const [selectedChapter, setSelectedChapter] = useState<ChapterId>("sampling");

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
  const dftWavePoints = useMemo(
    () =>
      buildCompositeWavePoints(0.18, [
        { frequency: dftState.primaryFrequency, amplitude: 1, phase: 0 },
        {
          frequency: dftState.secondaryFrequency,
          amplitude: dftState.secondaryAmplitude,
          phase: 0.8,
        },
      ]),
    [dftState],
  );
  const dftSpectrumBars = useMemo(
    () => buildDftSpectrumBars(dftState),
    [dftState],
  );
  const baseFilterFrequency = 6;
  const usefulGain = useMemo(
    () =>
      computeFilterGain(
        filterState.filterMode,
        baseFilterFrequency,
        filterState.cutoffFrequency,
        filterState.responseSharpness,
      ),
    [filterState],
  );
  const interferenceGain = useMemo(
    () =>
      computeFilterGain(
        filterState.filterMode,
        filterState.interferenceFrequency,
        filterState.cutoffFrequency,
        filterState.responseSharpness,
      ),
    [filterState],
  );
  const filterInputPoints = useMemo(
    () =>
      buildCompositeWavePoints(0.18, [
        { frequency: baseFilterFrequency, amplitude: 1, phase: 0 },
        {
          frequency: filterState.interferenceFrequency,
          amplitude: filterState.interferenceLevel,
          phase: 0.5,
        },
      ]),
    [filterState],
  );
  const filterOutputPoints = useMemo(
    () =>
      buildCompositeWavePoints(0.18, [
        { frequency: baseFilterFrequency, amplitude: usefulGain, phase: 0 },
        {
          frequency: filterState.interferenceFrequency,
          amplitude: filterState.interferenceLevel * interferenceGain,
          phase: 0.5,
        },
      ]),
    [filterState, usefulGain, interferenceGain],
  );
  const filterResponseCurve = useMemo(
    () =>
      buildFilterResponseCurve(
        filterState.filterMode,
        filterState.cutoffFrequency,
        filterState.responseSharpness,
      ),
    [filterState],
  );
  const systemAnalysis = useMemo(() => buildSystemAnalysis(systemState), [systemState]);

  const visibleWindow = `${Math.round(experimentState.duration * 1000)} ms`;
  const displayedSamples = sampledWave.length;
  const messages = messagesByChapter[selectedChapter];
  const coachCard = coachCards[selectedChapter];
  const evaluation = evaluations[selectedChapter];
  const quickPrompts = chapterQuickPrompts[selectedChapter];
  const chapterJourney = useMemo(
    () =>
      buildChapterJourney({
        chapterId: selectedChapter,
        journey,
        samplingStatus,
        experimentState,
        dftState,
        filterState,
        systemState,
        systemAnalysis,
        usefulGain,
        interferenceGain,
      }),
    [
      selectedChapter,
      journey,
      samplingStatus,
      experimentState,
      dftState,
      filterState,
      systemState,
      systemAnalysis,
      usefulGain,
      interferenceGain,
    ],
  );

  function updateExperimentState(patch: Partial<ExperimentState>) {
    setExperimentState((current) => ({ ...current, ...patch }));
    setEvaluations((current) => ({ ...current, sampling: null }));
  }

  function updateDftState(patch: Partial<DftState>) {
    setDftState((current) => ({ ...current, ...patch }));
    setEvaluations((current) => ({ ...current, dft: null }));
  }

  function updateFilterState(patch: Partial<FilterState>) {
    setFilterState((current) => ({ ...current, ...patch }));
    setEvaluations((current) => ({ ...current, filter: null }));
  }

  function updateSystemState(patch: Partial<SystemState>) {
    setSystemState((current) => ({ ...current, ...patch }));
    setEvaluations((current) => ({ ...current, system: null }));
  }

  function buildCurrentAiContext(chapterId: ChapterId) {
    const scopedJourney = buildChapterJourney({
      chapterId,
      journey,
      samplingStatus,
      experimentState,
      dftState,
      filterState,
      systemState,
      systemAnalysis,
      usefulGain,
      interferenceGain,
    });

    if (chapterId === "sampling") {
      return {
        chapterId,
        title: "采样、混叠与重建",
        experimentState,
        samplingStatus,
        visibleWindow,
        displayedSamples,
        journey: scopedJourney,
      };
    }

    if (chapterId === "dft") {
      return {
        chapterId,
        title: "DFT 与频谱分析",
        experimentState: dftState,
        summary: {
          windowMode: dftState.windowMode === "hann" ? "Hann 窗" : "矩形窗",
          primaryFrequency: dftState.primaryFrequency,
          secondaryFrequency: dftState.secondaryFrequency,
          secondaryAmplitude: dftState.secondaryAmplitude,
          fftSize: dftState.fftSize,
          leakageLevel: dftState.windowMode === "rect" ? "明显" : "受控",
        },
        journey: scopedJourney,
      };
    }

    if (chapterId === "filter") {
      return {
        chapterId,
        title: "数字滤波",
        experimentState: filterState,
        summary: {
          filterMode: filterState.filterMode === "lowpass" ? "低通" : "高通",
          cutoffFrequency: filterState.cutoffFrequency,
          interferenceFrequency: filterState.interferenceFrequency,
          interferenceLevel: filterState.interferenceLevel,
          responseSharpness: filterState.responseSharpness,
          usefulRetention: Number((usefulGain * 100).toFixed(0)),
          interferenceResidual: Number((interferenceGain * 100).toFixed(0)),
        },
        journey: scopedJourney,
      };
    }

    if (chapterId === "system") {
      return {
        chapterId,
        title: "离散系统响应",
        experimentState: systemState,
        summary: {
          inputType:
            systemState.inputType === "step"
              ? "阶跃输入"
              : systemState.inputType === "pulse"
                ? "脉冲输入"
                : "正弦输入",
          systemMode:
            systemState.systemMode === "smoothing"
              ? "平滑系统"
              : systemState.systemMode === "difference"
                ? "差分系统"
                : "延时系统",
          inputAmplitude: systemState.inputAmplitude,
          inputFrequency: systemState.inputFrequency,
          gain: systemState.gain,
          delaySamples: systemState.delaySamples,
          outputPeak: Number(systemAnalysis.outputPeak.toFixed(2)),
          responseTrait: systemAnalysis.responseTrait,
        },
        journey: scopedJourney,
      };
    }

    return {
      chapterId,
      title: "离散系统响应",
      summary: "该章节实验仍在扩展中。",
    };
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
    const activeChapter = selectedChapter;
    const nextMessages = [...messagesByChapter[activeChapter], userMessage];

    setMessagesByChapter((current) => ({
      ...current,
      [activeChapter]: nextMessages,
    }));
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapterId: activeChapter,
          messages: nextMessages,
          context: buildCurrentAiContext(activeChapter),
        }),
      });

      const data = (await response.json()) as ApiResponse;
      setMessagesByChapter((current) => ({
        ...current,
        [activeChapter]: [
          ...current[activeChapter],
          {
            role: "assistant",
            content:
              data.content ??
              data.error ??
              "模型暂时没有返回结果，请检查 API Key、模型权限和网络连接。",
          },
        ],
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "请求失败，请稍后重试。";
      setMessagesByChapter((current) => ({
        ...current,
        [activeChapter]: [
          ...current[activeChapter],
          {
            role: "assistant",
            content: `AI 助教暂时离线：${message}`,
          },
        ],
      }));
    } finally {
      setIsChatLoading(false);
    }
  }

  async function requestCoach() {
    if (isCoachLoading) {
      return;
    }

    const activeChapter = selectedChapter;
    setIsCoachLoading(true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapterId: activeChapter,
          context: buildCurrentAiContext(activeChapter),
          learningMoments: ["AI 导学", "AI 伴学", "AI 评学"],
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (data.card) {
        setCoachCards((current) => ({ ...current, [activeChapter]: data.card ?? null }));
      } else {
        setCoachCards((current) => ({
          ...current,
          [activeChapter]: {
            title: "AI 解读暂不可用",
            summary: data.error ?? "暂时无法生成实验解读。",
            observations: ["模型当前未返回实验现象总结。"],
            nextStep: "稍后重试，或先继续调整参数后再次生成。",
          },
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "暂时无法生成实验解读。";
      setCoachCards((current) => ({
        ...current,
        [activeChapter]: {
          title: "AI 解读暂不可用",
          summary: message,
          observations: ["模型当前未返回实验现象总结。"],
          nextStep: "稍后重试，或先继续调整参数后再次生成。",
        },
      }));
    } finally {
      setIsCoachLoading(false);
    }
  }

  async function requestEvaluation() {
    if (isEvaluationLoading) {
      return;
    }

    const activeChapter = selectedChapter;
    const activeJourney = buildChapterJourney({
      chapterId: activeChapter,
      journey,
      samplingStatus,
      experimentState,
      dftState,
      filterState,
      systemState,
      systemAnalysis,
      usefulGain,
      interferenceGain,
    });
    setIsEvaluationLoading(true);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chapterId: activeChapter,
          context: buildCurrentAiContext(activeChapter),
        }),
      });

      const data = (await response.json()) as ApiResponse;
      if (data.card) {
        setEvaluations((current) => ({ ...current, [activeChapter]: data.card ?? null }));
      } else {
        setEvaluations((current) => ({
          ...current,
          [activeChapter]: {
            title: "学习评价暂不可用",
            summary: data.error ?? "暂时无法生成学习评价。",
            observations: activeJourney.highlights,
            nextStep: activeJourney.recommendedAction,
          },
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "暂时无法生成学习评价。";
      setEvaluations((current) => ({
        ...current,
        [activeChapter]: {
          title: "学习评价暂不可用",
          summary: message,
          observations: activeJourney.highlights,
          nextStep: activeJourney.recommendedAction,
        },
      }));
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

  function handleChapterSelect(chapterId: ChapterId) {
    setSelectedChapter(chapterId);

    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("experiment");
      window.setTimeout(() => {
        try {
          window.scrollTo({ top: 0 });
        } catch {
          window.scrollTo(0, 0);
        }
      }, 0);
    }
  }

  const experimentPanel =
    selectedChapter === "sampling" ? (
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
    ) : selectedChapter === "dft" ? (
      <DftExperimentPanel dftState={dftState} spectrumBars={dftSpectrumBars} wavePoints={dftWavePoints} onUpdate={updateDftState} />
    ) : selectedChapter === "filter" ? (
      <FilterExperimentPanel
        filterState={filterState}
        inputPoints={filterInputPoints}
        outputPoints={filterOutputPoints}
        usefulGain={usefulGain}
        interferenceGain={interferenceGain}
        responseCurve={filterResponseCurve}
        onUpdate={updateFilterState}
      />
    ) : selectedChapter === "system" ? (
      <SystemExperimentPanel
        systemState={systemState}
        analysis={systemAnalysis}
        onUpdate={updateSystemState}
      />
    ) : (
      <ComingSoonPanel />
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
      placeholder={chapterInputPlaceholders[selectedChapter]}
      isChatLoading={isChatLoading}
      onInputChange={setInput}
      onSendPrompt={sendMessage}
      onSubmit={handleSubmit}
    />
  );

  const evaluationPanel = (
    <EvaluationPanel
      journey={chapterJourney}
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
            <ChapterLayoutSection
              chapterCards={chapterCards}
              selectedChapter={selectedChapter}
              onSelect={handleChapterSelect}
            />
          </div>
        ) : null}

        <div className="hidden lg:block">
          <ChapterLayoutSection
            chapterCards={chapterCards}
            selectedChapter={selectedChapter}
            onSelect={handleChapterSelect}
          />
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
  selectedChapter,
  onSelect,
}: {
  chapterCards: ChapterCard[];
  selectedChapter: ChapterId;
  onSelect: (chapterId: ChapterId) => void;
}) {
  return (
    <section className="apple-card rounded-[36px] p-5 lg:p-8">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              数字信号处理
            </h1>
            <KnowledgeBaseButton />
          </div>
          <AcademyIdentityCard />
        </div>

        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="grid min-w-max gap-4 px-1 md:grid-cols-2 xl:min-w-0 xl:grid-cols-4">
            {chapterCards.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => onSelect(chapter.id as ChapterId)}
                aria-pressed={selectedChapter === chapter.id}
                className={`badge-surface rounded-[28px] border p-5 text-left transition ${
                  selectedChapter === chapter.id
                    ? "border-blue-100 bg-gradient-to-br from-blue-50 to-white shadow-[0_14px_30px_rgba(37,99,235,0.12)]"
                    : "border-white/60 bg-white/68 hover:bg-white/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-950">{chapter.title}</h3>
                  <span className="soft-pill rounded-full px-3 py-1 text-xs font-medium text-slate-600">
                    {chapter.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{chapter.description}</p>
              </button>
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
  const [activeDomain, setActiveDomain] = useState<SamplingDomainView>("time");

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
          互动实验区
        </h2>
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

      <div className="mt-4 space-y-4">
        <div className="space-y-4">
          <div className="badge-surface flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {samplingDomainTabs.map((tab) => {
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
              <MiniMetric label="可视时间窗" value={visibleWindow} />
              <MiniMetric label="显示采样点" value={`${displayedSamples}`} />
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
          ) : activeDomain === "frequency" ? (
            <SpectrumPanel spectrum={spectrum} samplingRate={experimentState.samplingRate} />
          ) : (
            <FrequencySamplingPanel spectrum={spectrum} samplingRate={experimentState.samplingRate} />
          )}
        </div>

        <div className="badge-surface rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        </div>
      </div>
    </Panel>
  );
}

function DftExperimentPanel({
  dftState,
  spectrumBars,
  wavePoints,
  onUpdate,
}: {
  dftState: DftState;
  spectrumBars: Array<{ frequency: number; magnitude: number; tone: "primary" | "secondary" | "leakage" }>;
  wavePoints: Array<{ x: number; y: number }>;
  onUpdate: (patch: Partial<DftState>) => void;
}) {
  const [activeDomain, setActiveDomain] = useState<DomainView>("frequency");
  const leakageLevel = dftState.windowMode === "rect" ? "明显" : "受控";
  const fftWindowLabel = dftState.windowMode === "rect" ? "矩形窗" : "Hann 窗";

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
          DFT 与频谱分析
        </h2>
        <div className="flex flex-wrap gap-3">
          <StatusPill label="窗函数" value={fftWindowLabel} tone="accent" />
          <StatusPill label="点数" value={`${dftState.fftSize}`} tone="safe" />
          <StatusPill
            label="泄漏"
            value={leakageLevel}
            tone={dftState.windowMode === "rect" ? "risk" : "safe"}
          />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-4">
          <div className="badge-surface flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
              <MiniMetric label="主峰" value={`${dftState.primaryFrequency.toFixed(1)} Hz`} />
              <MiniMetric label="次峰" value={`${dftState.secondaryFrequency.toFixed(1)} Hz`} />
              <MiniMetric label="次峰幅值" value={dftState.secondaryAmplitude.toFixed(2)} />
              <MiniMetric label="窗函数" value={fftWindowLabel} />
            </div>
          </div>

          {activeDomain === "time" ? (
            <CompositeWavePanel title="时域组合信号" points={wavePoints} />
          ) : (
            <DftSpectrumBarsPanel bars={spectrumBars} fftSize={dftState.fftSize} />
          )}
        </div>

        <div className="badge-surface rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="mb-3 inline-flex rounded-full bg-slate-100 p-1">
            {[
              { id: "rect", label: "矩形窗" },
              { id: "hann", label: "Hann 窗" },
            ].map((item) => {
              const active = item.id === dftState.windowMode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onUpdate({ windowMode: item.id as "rect" | "hann" })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <SliderField
              label="主频"
              value={dftState.primaryFrequency}
              min={4}
              max={24}
              step={1}
              unit="Hz"
              onChange={(value) => onUpdate({ primaryFrequency: value })}
            />
            <SliderField
              label="次频"
              value={dftState.secondaryFrequency}
              min={10}
              max={48}
              step={1}
              unit="Hz"
              onChange={(value) => onUpdate({ secondaryFrequency: value })}
            />
            <SliderField
              label="次峰幅值"
              value={dftState.secondaryAmplitude}
              min={0.2}
              max={1.2}
              step={0.05}
              unit=""
              onChange={(value) => onUpdate({ secondaryAmplitude: value })}
            />
            <SliderField
              label="DFT 点数"
              value={dftState.fftSize}
              min={32}
              max={128}
              step={32}
              unit=""
              onChange={(value) => onUpdate({ fftSize: Math.round(value) })}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FilterExperimentPanel({
  filterState,
  inputPoints,
  outputPoints,
  usefulGain,
  interferenceGain,
  responseCurve,
  onUpdate,
}: {
  filterState: FilterState;
  inputPoints: Array<{ x: number; y: number }>;
  outputPoints: Array<{ x: number; y: number }>;
  usefulGain: number;
  interferenceGain: number;
  responseCurve: Array<{ x: number; y: number }>;
  onUpdate: (patch: Partial<FilterState>) => void;
}) {
  const [activeDomain, setActiveDomain] = useState<DomainView>("time");
  const baseFrequency = 6;

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
          数字滤波
        </h2>
        <div className="flex flex-wrap gap-3">
          <StatusPill
            label="模式"
            value={filterState.filterMode === "lowpass" ? "低通" : "高通"}
            tone="accent"
          />
          <StatusPill
            label="截止频率"
            value={`${filterState.cutoffFrequency.toFixed(1)} Hz`}
            tone="safe"
          />
          <StatusPill
            label="干扰残留"
            value={`${(interferenceGain * 100).toFixed(0)}%`}
            tone={interferenceGain < 0.35 ? "safe" : "risk"}
          />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-4">
          <div className="badge-surface flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
              <MiniMetric label="有效分量" value={`${baseFrequency.toFixed(1)} Hz`} />
              <MiniMetric label="干扰分量" value={`${filterState.interferenceFrequency.toFixed(1)} Hz`} />
              <MiniMetric label="有效保留" value={`${(usefulGain * 100).toFixed(0)}%`} />
              <MiniMetric label="干扰抑制" value={`${((1 - interferenceGain) * 100).toFixed(0)}%`} />
            </div>
          </div>

          {activeDomain === "time" ? (
            <FilterWavePanel inputPoints={inputPoints} outputPoints={outputPoints} />
          ) : (
            <FilterSpectrumPanel
              cutoffFrequency={filterState.cutoffFrequency}
              filterMode={filterState.filterMode}
              usefulFrequency={baseFrequency}
              usefulGain={usefulGain}
              interferenceFrequency={filterState.interferenceFrequency}
              interferenceGain={interferenceGain}
              interferenceLevel={filterState.interferenceLevel}
              responseCurve={responseCurve}
            />
          )}
        </div>

        <div className="badge-surface rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="mb-3 inline-flex rounded-full bg-slate-100 p-1">
            {[
              { id: "lowpass", label: "低通" },
              { id: "highpass", label: "高通" },
            ].map((item) => {
              const active = item.id === filterState.filterMode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onUpdate({ filterMode: item.id as "lowpass" | "highpass" })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <SliderField
              label="截止频率"
              value={filterState.cutoffFrequency}
              min={6}
              max={32}
              step={1}
              unit="Hz"
              onChange={(value) => onUpdate({ cutoffFrequency: value })}
            />
            <SliderField
              label="干扰频率"
              value={filterState.interferenceFrequency}
              min={12}
              max={48}
              step={1}
              unit="Hz"
              onChange={(value) => onUpdate({ interferenceFrequency: value })}
            />
            <SliderField
              label="干扰强度"
              value={filterState.interferenceLevel}
              min={0.2}
              max={1.2}
              step={0.05}
              unit=""
              onChange={(value) => onUpdate({ interferenceLevel: value })}
            />
            <SliderField
              label="响应陡度"
              value={filterState.responseSharpness}
              min={0.6}
              max={2}
              step={0.1}
              unit=""
              onChange={(value) => onUpdate({ responseSharpness: value })}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SystemExperimentPanel({
  systemState,
  analysis,
  onUpdate,
}: {
  systemState: SystemState;
  analysis: SystemAnalysis;
  onUpdate: (patch: Partial<SystemState>) => void;
}) {
  const [activeDomain, setActiveDomain] = useState<DomainView>("time");
  const inputLabel =
    systemState.inputType === "step"
      ? "阶跃"
      : systemState.inputType === "pulse"
        ? "脉冲"
        : "正弦";
  const systemLabel =
    systemState.systemMode === "smoothing"
      ? "平滑系统"
      : systemState.systemMode === "difference"
        ? "差分系统"
        : "延时系统";

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
          离散系统响应
        </h2>
        <div className="flex flex-wrap gap-3">
          <StatusPill label="输入" value={inputLabel} tone="accent" />
          <StatusPill label="系统" value={systemLabel} tone="safe" />
          <StatusPill label="输出峰值" value={analysis.outputPeak.toFixed(2)} tone="risk" />
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-4">
          <div className="badge-surface flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
              <MiniMetric label="输入类型" value={inputLabel} />
              <MiniMetric label="系统类型" value={systemLabel} />
              <MiniMetric label="增益" value={systemState.gain.toFixed(2)} />
              <MiniMetric label="延时" value={`${systemState.delaySamples}`} />
            </div>
          </div>

          {activeDomain === "time" ? (
            <SystemWavePanel inputPoints={analysis.inputPoints} outputPoints={analysis.outputPoints} />
          ) : (
            <SystemResponsePanel
              responseCurve={analysis.responseCurve}
              systemMode={systemState.systemMode}
              responseTrait={analysis.responseTrait}
            />
          )}
        </div>

        <div className="badge-surface rounded-[30px] border border-white/70 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="mb-3 flex flex-wrap gap-3">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {[
                { id: "step", label: "阶跃" },
                { id: "pulse", label: "脉冲" },
                { id: "sine", label: "正弦" },
              ].map((item) => {
                const active = item.id === systemState.inputType;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdate({ inputType: item.id as SystemState["inputType"] })}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {[
                { id: "smoothing", label: "平滑" },
                { id: "difference", label: "差分" },
                { id: "delay", label: "延时" },
              ].map((item) => {
                const active = item.id === systemState.systemMode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdate({ systemMode: item.id as SystemState["systemMode"] })}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
            <SliderField
              label="输入幅值"
              value={systemState.inputAmplitude}
              min={0.5}
              max={1.8}
              step={0.1}
              unit=""
              onChange={(value) => onUpdate({ inputAmplitude: value })}
            />
            <SliderField
              label="输入频率"
              value={systemState.inputFrequency}
              min={1}
              max={8}
              step={0.5}
              unit="Hz"
              onChange={(value) => onUpdate({ inputFrequency: value })}
            />
            <SliderField
              label="系统增益"
              value={systemState.gain}
              min={0.4}
              max={1.8}
              step={0.1}
              unit=""
              onChange={(value) => onUpdate({ gain: value })}
            />
            <SliderField
              label="延时样本"
              value={systemState.delaySamples}
              min={1}
              max={8}
              step={1}
              unit=""
              onChange={(value) => onUpdate({ delaySamples: Math.round(value) })}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ComingSoonPanel() {
  return (
    <Panel>
      <div className="rounded-[30px] border border-dashed border-slate-200 bg-white/70 px-6 py-12 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">离散系统响应</h2>
        <p className="mt-4 text-sm leading-7 text-slate-500">该章节实验入口仍在扩展中。</p>
      </div>
    </Panel>
  );
}

function CoachPanel({
  coachCard,
  isCoachLoading,
  onRequestCoach,
}: {
  coachCard: GuidanceCard | null;
  isCoachLoading: boolean;
  onRequestCoach: () => Promise<void>;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">AI 实验解读</h2>
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

      {coachCard ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <InsightCard title={coachCard.title} emphasis>
              <p>{coachCard.summary}</p>
            </InsightCard>
            <InsightCard title="下一步建议">
              <p>{coachCard.nextStep}</p>
            </InsightCard>
          </div>

          <div className="badge-surface mt-4 rounded-[28px] bg-slate-50/90 p-4">
            <p className="text-sm font-semibold text-slate-950">关键现象</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {coachCard.observations.map((item) => (
                <div
                  key={item}
                  className="badge-surface rounded-[22px] bg-white/92 p-3 text-sm leading-6 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="badge-surface min-h-[188px] rounded-[28px] bg-slate-50/80" />
          <div className="badge-surface min-h-[188px] rounded-[28px] bg-slate-50/80" />
        </div>
      )}
    </Panel>
  );
}

function AssistantPanel({
  quickPrompts,
  messages,
  input,
  placeholder,
  isChatLoading,
  onInputChange,
  onSendPrompt,
  onSubmit,
}: {
  quickPrompts: string[];
  messages: ChatMessage[];
  input: string;
  placeholder: string;
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
          placeholder={placeholder}
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
  journey: ChapterJourney;
  evaluation: GuidanceCard | null;
  isEvaluationLoading: boolean;
  onRequestEvaluation: () => Promise<void>;
}) {
  return (
    <Panel>
      <div className="space-y-3">
        <SectionTitle eyebrow="过程评价" title="学习轨迹与智能诊断" />
        <p className="text-sm leading-7 text-slate-600">
          点击按钮后，系统会根据
          <strong className="font-semibold text-slate-900">当前实验状态</strong>
          和
          <strong className="font-semibold text-slate-900">本轮操作轨迹</strong>
          生成过程性评价。
        </p>
        <button
          type="button"
          onClick={() => void onRequestEvaluation()}
          disabled={isEvaluationLoading}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isEvaluationLoading ? "AI 生成中..." : "生成评价"}
        </button>
      </div>

        <div className="badge-surface mt-5 rounded-[28px] bg-slate-50/90 p-4">
          <p className="text-sm font-semibold text-slate-950">当前学习轨迹</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {journey.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {evaluation ? (
        <div className="badge-surface-dark mt-4 rounded-[28px] bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white">
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
        <div className="badge-surface mt-4 rounded-[28px] border border-dashed border-slate-200 bg-white/62 px-4 py-6 text-sm leading-7 text-slate-500">
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

function KnowledgeBaseButton() {
  return (
    <Link
      href="/knowledge-base"
      aria-label="打开知识库"
      title="知识库"
      className="group relative inline-flex h-12 shrink-0 items-center gap-2 overflow-hidden rounded-[18px] border border-white/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(37,99,235,0.9)_100%)] px-4 shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition hover:scale-[1.03] hover:shadow-[0_18px_36px_rgba(37,99,235,0.24)]"
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_55%)]" />
      <svg
        viewBox="0 0 24 24"
        className="relative h-5 w-5 text-white transition group-hover:scale-105"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6.5 5.5A2.5 2.5 0 0 1 9 3h8v15h-8a2.5 2.5 0 0 0-2.5 2.5V5.5Z" />
        <path d="M6.5 5.5A2.5 2.5 0 0 0 4 3H3v15h6" />
        <path d="M10 7h4" />
        <path d="M10 10h4" />
        <path d="M15.5 15.5 20 20" />
        <circle cx="13.5" cy="13.5" r="2.5" />
      </svg>
      <span className="relative text-sm font-semibold tracking-wide text-white">知识库</span>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="badge-surface rounded-[22px] bg-slate-50 p-3">
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
    <div className="badge-surface-dark rounded-[30px] bg-[linear-gradient(180deg,#1f355f_0%,#10223f_100%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
    <div className="badge-surface rounded-[30px] bg-white/82 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">频谱观察</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            绿色谱线表示采样后产生的频谱镜像；当镜像落入 Nyquist 区间时，会看到混叠后的低频结果。
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
        {spectrum.sampledMarkers.map((marker) => (
          <g key={`${marker.label}-${marker.x}`} opacity="0.72">
            <line
              x1={marker.x}
              y1="192"
              x2={marker.x}
              y2={marker.y}
              stroke={marker.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="8 7"
            />
            <circle cx={marker.x} cy={marker.y} r="6" fill={marker.color} />
            <text x={marker.x} y={marker.y - 12} textAnchor="middle" fill="#166534" fontSize="11">
              {marker.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
        <LegendDot color="bg-blue-600" label="原始频率" />
        <LegendDot color="bg-amber-400" label="Nyquist" />
        <LegendDot color="bg-orange-500" label="混叠频率" />
        <LegendDot color="bg-green-500" label="采样后频谱镜像" />
        <LegendDot color="bg-slate-900" label="采样率" />
      </div>
    </div>
  );
}

function CompositeWavePanel({
  title,
  points,
}: {
  title: string;
  points: Array<{ x: number; y: number }>;
}) {
  const path = formatChartPoints(points);

  return (
    <div className="badge-surface-dark rounded-[30px] bg-[linear-gradient(180deg,#43245d_0%,#1b2348_100%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-slate-200">
          双频组合
        </span>
      </div>
      <svg viewBox="0 0 960 420" className="h-[320px] w-full rounded-[24px] bg-[#1a2247]">
        <rect x="0" y="0" width="960" height="420" rx="24" fill="#1a2247" />
        {Array.from({ length: 7 }).map((_, index) => {
          const y = 60 + index * 50;
          return <line key={y} x1="44" y1={y} x2="916" y2={y} stroke="#4a3d74" strokeWidth="1" />;
        })}
        {Array.from({ length: 10 }).map((_, index) => {
          const x = 44 + index * 87.2;
          return <line key={x} x1={x} y1="40" x2={x} y2="380" stroke="#4a3d74" strokeWidth="1" />;
        })}
        <line x1="44" y1="210" x2="916" y2="210" stroke="#8f82c9" strokeWidth="1.4" />
        <path d={path} fill="none" stroke="#c4b5fd" strokeWidth="4" />
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
        <LegendDot color="bg-sky-300" label="时域叠加信号" />
      </div>
    </div>
  );
}

function DftSpectrumBarsPanel({
  bars,
  fftSize,
}: {
  bars: Array<{ frequency: number; magnitude: number; tone: "primary" | "secondary" | "leakage" }>;
  fftSize: number;
}) {
  const maxMagnitude = Math.max(...bars.map((item) => item.magnitude), 1);

  return (
    <div className="badge-surface rounded-[30px] bg-[linear-gradient(180deg,#f8f3ff_0%,#eef2ff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">离散频谱</h3>
        <span className="soft-pill rounded-full px-4 py-2 text-sm font-medium text-slate-600">
          N = {fftSize}
        </span>
      </div>

      <svg viewBox="0 0 960 260" className="mt-5 h-[320px] w-full rounded-[24px] bg-[#f7f0ff]">
        <rect x="0" y="0" width="960" height="260" rx="24" fill="#f7f0ff" />
        <line x1="60" y1="212" x2="900" y2="212" stroke="#cbd5e1" strokeWidth="2" />
        {bars.map((bar, index) => {
          const x = 72 + index * 44;
          const height = (bar.magnitude / maxMagnitude) * 142;
          const toneMap = {
            primary: "#7c3aed",
            secondary: "#ec4899",
            leakage: "#d8b4fe",
          };

          return (
            <g key={`${bar.frequency}-${bar.tone}`}>
              <rect
                x={x}
                y={212 - height}
                width="24"
                height={height}
                rx="10"
                fill={toneMap[bar.tone]}
              />
              {bar.tone !== "leakage" ? (
                <text x={x + 12} y={212 - height - 10} textAnchor="middle" fill="#0f172a" fontSize="12">
                  {bar.frequency}
                </text>
              ) : null}
              <text x={x + 12} y="236" textAnchor="middle" fill="#64748b" fontSize="11">
                {bar.frequency}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
        <LegendDot color="bg-blue-600" label="主频峰值" />
        <LegendDot color="bg-orange-500" label="次频峰值" />
        <LegendDot color="bg-slate-300" label="泄漏旁瓣" />
      </div>
    </div>
  );
}

function FilterWavePanel({
  inputPoints,
  outputPoints,
}: {
  inputPoints: Array<{ x: number; y: number }>;
  outputPoints: Array<{ x: number; y: number }>;
}) {
  const inputPath = formatChartPoints(inputPoints);
  const outputPath = formatChartPoints(outputPoints);

  return (
    <div className="badge-surface-dark rounded-[30px] bg-[linear-gradient(180deg,#17483d_0%,#102926_100%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">输入 / 输出波形</h3>
        <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-slate-200">
          滤波前后
        </span>
      </div>
      <svg viewBox="0 0 960 420" className="h-[320px] w-full rounded-[24px] bg-[#102926]">
        <rect x="0" y="0" width="960" height="420" rx="24" fill="#102926" />
        {Array.from({ length: 7 }).map((_, index) => {
          const y = 60 + index * 50;
          return <line key={y} x1="44" y1={y} x2="916" y2={y} stroke="#295c4d" strokeWidth="1" />;
        })}
        {Array.from({ length: 10 }).map((_, index) => {
          const x = 44 + index * 87.2;
          return <line key={x} x1={x} y1="40" x2={x} y2="380" stroke="#295c4d" strokeWidth="1" />;
        })}
        <line x1="44" y1="210" x2="916" y2="210" stroke="#75a58c" strokeWidth="1.4" />
        <path d={inputPath} fill="none" stroke="#86efac" strokeWidth="3.5" />
        <path d={outputPath} fill="none" stroke="#facc15" strokeWidth="3.5" strokeDasharray="10 8" />
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
        <LegendDot color="bg-sky-300" label="输入信号" />
        <LegendDot color="bg-amber-400" label="滤波输出" />
      </div>
    </div>
  );
}

function FilterSpectrumPanel({
  cutoffFrequency,
  filterMode,
  usefulFrequency,
  usefulGain,
  interferenceFrequency,
  interferenceGain,
  interferenceLevel,
  responseCurve,
}: {
  cutoffFrequency: number;
  filterMode: "lowpass" | "highpass";
  usefulFrequency: number;
  usefulGain: number;
  interferenceFrequency: number;
  interferenceGain: number;
  interferenceLevel: number;
  responseCurve: Array<{ x: number; y: number }>;
}) {
  const responsePath = formatChartPoints(responseCurve);
  const usefulX = 60 + (usefulFrequency / 60) * 840;
  const interferenceX = 60 + (interferenceFrequency / 60) * 840;
  const cutoffX = 60 + (cutoffFrequency / 60) * 840;

  return (
    <div className="badge-surface rounded-[30px] bg-[linear-gradient(180deg,#effcf7_0%,#e9fbf2_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">频域响应</h3>
        <span className="soft-pill rounded-full px-4 py-2 text-sm font-medium text-slate-600">
          {filterMode === "lowpass" ? "低通响应" : "高通响应"}
        </span>
      </div>

      <svg viewBox="0 0 960 260" className="mt-5 h-[320px] w-full rounded-[24px] bg-[#eefcf4]">
        <rect x="0" y="0" width="960" height="260" rx="24" fill="#eefcf4" />
        <line x1="60" y1="212" x2="900" y2="212" stroke="#cbd5e1" strokeWidth="2" />
        {Array.from({ length: 7 }).map((_, index) => {
          const x = 60 + index * 140;
          return (
            <g key={x}>
              <line x1={x} y1="32" x2={x} y2="212" stroke="#e2e8f0" strokeWidth="1" />
              <text x={x} y="236" textAnchor="middle" fill="#64748b" fontSize="12">
                {index * 10}
              </text>
            </g>
          );
        })}
        <path d={responsePath} fill="none" stroke="#059669" strokeWidth="4" />
        <line x1={cutoffX} y1="36" x2={cutoffX} y2="212" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 8" />
        <rect x={usefulX - 12} y={212 - usefulGain * 120} width="24" height={usefulGain * 120} rx="10" fill="#0f172a" />
        <rect
          x={interferenceX - 12}
          y={212 - interferenceGain * interferenceLevel * 120}
          width="24"
          height={interferenceGain * interferenceLevel * 120}
          rx="10"
          fill="#f59e0b"
        />
        <text x={usefulX} y={212 - usefulGain * 120 - 10} textAnchor="middle" fill="#0f172a" fontSize="12">
          {usefulFrequency}
        </text>
        <text x={interferenceX} y={212 - interferenceGain * interferenceLevel * 120 - 10} textAnchor="middle" fill="#0f172a" fontSize="12">
          {interferenceFrequency}
        </text>
      </svg>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
        <LegendDot color="bg-slate-900" label="有效分量" />
        <LegendDot color="bg-amber-400" label="干扰残留" />
        <LegendDot color="bg-blue-600" label="滤波响应" />
      </div>
    </div>
  );
}

function SystemWavePanel({
  inputPoints,
  outputPoints,
}: {
  inputPoints: Array<{ x: number; y: number }>;
  outputPoints: Array<{ x: number; y: number }>;
}) {
  const inputPath = formatChartPoints(inputPoints);
  const outputPath = formatChartPoints(outputPoints);

  return (
    <div className="badge-surface-dark rounded-[30px] bg-[linear-gradient(180deg,#5a2f12_0%,#2c190e_100%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">输入 / 输出响应</h3>
        <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-slate-200">
          系统作用前后
        </span>
      </div>
      <svg viewBox="0 0 960 420" className="h-[320px] w-full rounded-[24px] bg-[#2c190e]">
        <rect x="0" y="0" width="960" height="420" rx="24" fill="#2c190e" />
        {Array.from({ length: 7 }).map((_, index) => {
          const y = 60 + index * 50;
          return <line key={y} x1="44" y1={y} x2="916" y2={y} stroke="#6f4424" strokeWidth="1" />;
        })}
        {Array.from({ length: 10 }).map((_, index) => {
          const x = 44 + index * 87.2;
          return <line key={x} x1={x} y1="40" x2={x} y2="380" stroke="#6f4424" strokeWidth="1" />;
        })}
        <line x1="44" y1="210" x2="916" y2="210" stroke="#bf8a62" strokeWidth="1.4" />
        <path d={inputPath} fill="none" stroke="#fdba74" strokeWidth="3.5" />
        <path d={outputPath} fill="none" stroke="#fef3c7" strokeWidth="3.5" strokeDasharray="12 8" />
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
        <LegendDot color="bg-orange-300" label="输入信号" />
        <LegendDot color="bg-amber-100" label="输出响应" />
      </div>
    </div>
  );
}

function SystemResponsePanel({
  responseCurve,
  systemMode,
  responseTrait,
}: {
  responseCurve: Array<{ x: number; y: number }>;
  systemMode: SystemState["systemMode"];
  responseTrait: string;
}) {
  const responsePath = formatChartPoints(responseCurve);
  const curveColor =
    systemMode === "smoothing" ? "#d97706" : systemMode === "difference" ? "#ea580c" : "#92400e";

  return (
    <div className="badge-surface rounded-[30px] bg-[linear-gradient(180deg,#fff7ed_0%,#fef3c7_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">系统频域特性</h3>
        <span className="soft-pill rounded-full px-4 py-2 text-sm font-medium text-slate-600">
          {responseTrait}
        </span>
      </div>

      <svg viewBox="0 0 960 260" className="mt-5 h-[320px] w-full rounded-[24px] bg-[#fff8ef]">
        <rect x="0" y="0" width="960" height="260" rx="24" fill="#fff8ef" />
        <line x1="60" y1="212" x2="900" y2="212" stroke="#e7c9a8" strokeWidth="2" />
        {Array.from({ length: 7 }).map((_, index) => {
          const x = 60 + index * 140;
          return (
            <g key={x}>
              <line x1={x} y1="32" x2={x} y2="212" stroke="#f1dcc6" strokeWidth="1" />
              <text x={x} y="236" textAnchor="middle" fill="#9a6a43" fontSize="12">
                {index === 0 ? "0" : `${index / 6}π`}
              </text>
            </g>
          );
        })}
        <path d={responsePath} fill="none" stroke={curveColor} strokeWidth="4" />
      </svg>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
        <LegendDot color="bg-amber-600" label="系统幅频响应" />
      </div>
    </div>
  );
}

function FrequencySamplingPanel({
  spectrum,
  samplingRate,
}: {
  spectrum: SpectrumAnalysis;
  samplingRate: number;
}) {
  return (
    <div className="badge-surface rounded-[30px] bg-[linear-gradient(180deg,#eefaf4_0%,#f8fff9_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">频域采样实验</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            时域采样会让频谱按采样率周期复制；拖动采样率时，绿色镜像谱会一起移动。
          </p>
        </div>
        <span className="soft-pill rounded-full px-4 py-2 text-sm font-medium text-slate-600">
          复制周期 fs = {samplingRate.toFixed(1)} Hz
        </span>
      </div>

      <svg viewBox="0 0 960 300" className="mt-5 h-[340px] w-full rounded-[24px] bg-[#f3fff7]">
        <rect x="0" y="0" width="960" height="300" rx="24" fill="#f3fff7" />
        <line x1="70" y1="232" x2="890" y2="232" stroke="#bbd7c4" strokeWidth="2" />
        {spectrum.ticks.map((tick) => {
          const x = 70 + (tick / spectrum.axisMax) * 820;
          return (
            <g key={tick}>
              <line x1={x} y1="44" x2={x} y2="232" stroke="#d8eadf" strokeWidth="1" />
              <text x={x} y="258" textAnchor="middle" fill="#4b6b56" fontSize="12">
                {tick}
              </text>
            </g>
          );
        })}
        {spectrum.sampledMarkers.map((marker) => (
          <g key={`sampled-${marker.label}-${marker.x}`}>
            <line
              x1={marker.x}
              y1="232"
              x2={marker.x}
              y2={marker.y + 32}
              stroke="#16a34a"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <circle cx={marker.x} cy={marker.y + 32} r="8" fill="#22c55e" />
            <text x={marker.x} y={marker.y + 15} textAnchor="middle" fill="#166534" fontSize="12">
              {marker.label.replace("采样谱 ", "")}
            </text>
          </g>
        ))}
        {spectrum.markers
          .filter((marker) => marker.label.startsWith("原始") || marker.label.startsWith("混叠"))
          .map((marker) => (
            <g key={`base-${marker.label}`}>
              <line
                x1={marker.x}
                y1="232"
                x2={marker.x}
                y2={marker.y + 34}
                stroke={marker.color}
                strokeWidth="9"
                strokeLinecap="round"
              />
              <circle cx={marker.x} cy={marker.y + 34} r="8" fill={marker.color} />
              <text x={marker.x} y={marker.y + 17} textAnchor="middle" fill="#0f172a" fontSize="12">
                {marker.label}
              </text>
            </g>
          ))}
      </svg>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
        <LegendDot color="bg-blue-600" label="原始频率" />
        <LegendDot color="bg-green-500" label="采样复制频谱" />
        <LegendDot color="bg-orange-500" label="混叠落点" />
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
    <label className="badge-surface block rounded-[28px] bg-slate-50/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="space-y-3">
        <span className="block text-lg font-semibold tracking-[0.06em] text-slate-800">{label}</span>
        <div className="flex items-center justify-center gap-2.5">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value.toFixed(decimals)}
            onChange={(event) => onChange(clampValue(event.currentTarget.valueAsNumber))}
            className="w-full max-w-[9.5rem] rounded-full border border-blue-200 bg-white px-4 py-2.5 text-center text-xl font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          <span className="soft-pill rounded-full px-3 py-2 text-base font-semibold text-slate-700">
            {unit || "值"}
          </span>
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
      </div>
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
      className={`${
        emphasis ? "badge-surface-dark" : "badge-surface"
      } rounded-[28px] p-4 text-sm leading-7 ${
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

function buildChapterJourney({
  chapterId,
  journey,
  samplingStatus,
  experimentState,
  dftState,
  filterState,
  systemState,
  systemAnalysis,
  usefulGain,
  interferenceGain,
}: {
  chapterId: ChapterId;
  journey: ReturnType<typeof generateStudentJourney>;
  samplingStatus: ReturnType<typeof describeSamplingStatus>;
  experimentState: ExperimentState;
  dftState: DftState;
  filterState: FilterState;
  systemState: SystemState;
  systemAnalysis: SystemAnalysis;
  usefulGain: number;
  interferenceGain: number;
}): ChapterJourney {
  if (chapterId === "sampling") {
    return journey;
  }

  if (chapterId === "dft") {
    return {
      highlights: [
        `当前主峰 ${dftState.primaryFrequency.toFixed(1)} Hz，次峰 ${dftState.secondaryFrequency.toFixed(1)} Hz。`,
        `当前采用 ${dftState.windowMode === "hann" ? "Hann 窗" : "矩形窗"}，DFT 点数 ${dftState.fftSize}。`,
        dftState.windowMode === "rect"
          ? "学生已经看到更明显的频谱泄漏，适合解释旁瓣和窗函数作用。"
          : "学生已经看到窗函数抑制旁瓣的效果，适合比较分辨率与泄漏的取舍。",
      ],
      recommendedAction:
        dftState.windowMode === "rect"
          ? "切换到 Hann 窗，再比较主峰附近旁瓣的收缩程度。"
          : "继续拉近两条频率，观察频率分辨能力与点数变化的关系。",
    };
  }

  if (chapterId === "filter") {
    return {
      highlights: [
        `当前为${filterState.filterMode === "lowpass" ? "低通" : "高通"}模式，截止频率 ${filterState.cutoffFrequency.toFixed(1)} Hz。`,
        `干扰频率 ${filterState.interferenceFrequency.toFixed(1)} Hz，当前残留约 ${(interferenceGain * 100).toFixed(0)}%。`,
        `有效分量保留约 ${(usefulGain * 100).toFixed(0)}%，已形成输入输出差异对比。`,
      ],
      recommendedAction:
        filterState.filterMode === "lowpass"
          ? "尝试继续降低截止频率，观察干扰削弱与有效信号失真的边界。"
          : "尝试提高截止频率，对比高频保留增加后输出波形的变化。",
    };
  }

  if (chapterId === "system") {
    return {
      highlights: [
        `当前输入为${systemState.inputType === "step" ? "阶跃" : systemState.inputType === "pulse" ? "脉冲" : "正弦"}信号。`,
        `当前系统为${systemState.systemMode === "smoothing" ? "平滑系统" : systemState.systemMode === "difference" ? "差分系统" : "延时系统"}，增益 ${systemState.gain.toFixed(2)}。`,
        `当前输出峰值约 ${systemAnalysis.outputPeak.toFixed(2)}，系统表现为${systemAnalysis.responseTrait}。`,
      ],
      recommendedAction:
        systemState.systemMode === "smoothing"
          ? "切换到差分系统，再比较同一输入下输出由平滑变尖锐的变化。"
          : systemState.systemMode === "difference"
            ? "改成阶跃输入，观察差分系统为何更突出突变位置。"
            : "继续增加延时样本，判断系统是否只改变相位而不改变幅值趋势。",
    };
  }

  return {
    highlights: [
      `当前采样率 ${experimentState.samplingRate.toFixed(1)} Hz，信号频率 ${experimentState.signalFrequency.toFixed(1)} Hz。`,
      `当前状态：${samplingStatus.label}。`,
    ],
    recommendedAction: "继续选择已开放章节进行实验。",
  };
}

function buildCompositeWavePoints(
  duration: number,
  components: Array<{ frequency: number; amplitude: number; phase: number }>,
  pointCount = 260,
) {
  const points = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const time = (index / pointCount) * duration;
    const value = components.reduce(
      (sum, component) =>
        sum +
        component.amplitude * Math.sin(2 * Math.PI * component.frequency * time + component.phase),
      0,
    );

    points.push({
      x: 44 + (index / pointCount) * 872,
      y: 210 - value * 74,
    });
  }

  return points;
}

function buildDftSpectrumBars({
  primaryFrequency,
  secondaryFrequency,
  secondaryAmplitude,
  windowMode,
  fftSize,
}: {
  primaryFrequency: number;
  secondaryFrequency: number;
  secondaryAmplitude: number;
  windowMode: "rect" | "hann";
  fftSize: number;
}) {
  const bins = Array.from({ length: 18 }, (_, index) => 4 + index * 3);
  const narrowSpread = windowMode === "rect" ? 1.6 : 1.1;
  const leakageSpread = windowMode === "rect" ? 5.6 : 2.8;
  const leakageScale = windowMode === "rect" ? 0.34 : 0.12;
  const resolutionBoost = Math.max(0.72, Math.min(1.12, fftSize / 64));

  return bins.map((frequency) => {
    const primaryPeak = Math.exp(-((frequency - primaryFrequency) ** 2) / (2 * narrowSpread ** 2));
    const secondaryPeak =
      secondaryAmplitude *
      Math.exp(-((frequency - secondaryFrequency) ** 2) / (2 * narrowSpread ** 2));
    const leakageTail =
      leakageScale *
      (Math.exp(-((frequency - primaryFrequency) ** 2) / (2 * leakageSpread ** 2)) +
        secondaryAmplitude *
          Math.exp(-((frequency - secondaryFrequency) ** 2) / (2 * leakageSpread ** 2)));
    const magnitude = (primaryPeak + secondaryPeak + leakageTail) * resolutionBoost;

    let tone: "primary" | "secondary" | "leakage" = "leakage";

    if (Math.abs(frequency - primaryFrequency) <= 1.5) {
      tone = "primary";
    } else if (Math.abs(frequency - secondaryFrequency) <= 1.5) {
      tone = "secondary";
    }

    return {
      frequency,
      magnitude,
      tone,
    };
  });
}

function computeFilterGain(
  filterMode: "lowpass" | "highpass",
  frequency: number,
  cutoffFrequency: number,
  sharpness: number,
) {
  const ratio = Math.max(frequency / Math.max(cutoffFrequency, 0.1), 0.01);
  const order = Math.max(1, Math.round(sharpness * 4));
  const lowpass = 1 / Math.sqrt(1 + ratio ** (2 * order));

  return filterMode === "lowpass" ? lowpass : Math.sqrt(Math.max(0, 1 - lowpass ** 2));
}

function buildFilterResponseCurve(
  filterMode: "lowpass" | "highpass",
  cutoffFrequency: number,
  sharpness: number,
) {
  const points = [];

  for (let index = 0; index <= 240; index += 1) {
    const frequency = (index / 240) * 60;
    const gain = computeFilterGain(filterMode, frequency, cutoffFrequency, sharpness);

    points.push({
      x: 60 + (frequency / 60) * 840,
      y: 212 - gain * 150,
    });
  }

  return points;
}

function buildSystemAnalysis(systemState: SystemState): SystemAnalysis {
  const sampleCount = 36;
  const inputSamples = Array.from({ length: sampleCount }, (_, index) => {
    if (systemState.inputType === "step") {
      return index >= 8 ? systemState.inputAmplitude : 0;
    }

    if (systemState.inputType === "pulse") {
      return index >= 8 && index <= 10 ? systemState.inputAmplitude : 0;
    }

    return systemState.inputAmplitude * Math.sin((2 * Math.PI * systemState.inputFrequency * index) / sampleCount);
  });

  const outputSamples = inputSamples.map((sample, index, samples) => {
    if (systemState.systemMode === "smoothing") {
      const previous = index === 0 ? 0 : samples[index - 1];
      return systemState.gain * 0.5 * (sample + previous);
    }

    if (systemState.systemMode === "difference") {
      const previous = index === 0 ? 0 : samples[index - 1];
      return systemState.gain * (sample - previous);
    }

    const delayedIndex = index - systemState.delaySamples;
    return systemState.gain * (delayedIndex >= 0 ? samples[delayedIndex] : 0);
  });

  const mapSamplesToPoints = (samples: number[]) =>
    samples.map((sample, index) => ({
      x: 44 + (index / (sampleCount - 1)) * 872,
      y: 210 - sample * 78,
    }));

  const responseCurve = Array.from({ length: 240 }, (_, index) => {
    const omega = (index / 239) * Math.PI;
    let magnitude = 1;

    if (systemState.systemMode === "smoothing") {
      magnitude = systemState.gain * Math.abs(Math.cos(omega / 2));
    } else if (systemState.systemMode === "difference") {
      magnitude = systemState.gain * Math.abs(2 * Math.sin(omega / 2));
    } else {
      magnitude = systemState.gain;
    }

    const normalizedMagnitude = Math.min(magnitude / 2, 1.2);

    return {
      x: 60 + (index / 239) * 840,
      y: 212 - normalizedMagnitude * 150,
    };
  });

  return {
    inputSamples,
    outputSamples,
    inputPoints: mapSamplesToPoints(inputSamples),
    outputPoints: mapSamplesToPoints(outputSamples),
    responseCurve,
    outputPeak: Math.max(...outputSamples.map((sample) => Math.abs(sample)), 0),
    responseTrait:
      systemState.systemMode === "smoothing"
        ? "低频保留更强"
        : systemState.systemMode === "difference"
          ? "高频增强更明显"
          : "主要体现相位延后",
  };
}
