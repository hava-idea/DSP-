export type ExperimentState = {
  signalFrequency: number;
  samplingRate: number;
  amplitude: number;
  phase: number;
  noiseLevel: number;
  duration: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GuidanceCard = {
  title: string;
  summary: string;
  observations: string[];
  nextStep: string;
};

export type ChapterCard = {
  id: string;
  title: string;
  status: string;
  description: string;
};

export type SpectrumMarker = {
  x: number;
  y: number;
  label: string;
  color: string;
};

export type SpectrumAnalysis = {
  axisMax: number;
  ticks: number[];
  markers: SpectrumMarker[];
};

const DISPLAY_RANGE = 2.6;
const AXIS_LEFT = 44;
const AXIS_WIDTH = 872;

export function createDefaultExperimentState(): ExperimentState {
  return {
    signalFrequency: 18,
    samplingRate: 20,
    amplitude: 1,
    phase: 0,
    noiseLevel: 0.08,
    duration: 0.24,
  };
}

export function aliasFrequency(signalFrequency: number, samplingRate: number) {
  if (samplingRate <= 0) {
    return 0;
  }

  const wrapped = ((signalFrequency % samplingRate) + samplingRate) % samplingRate;
  return wrapped > samplingRate / 2 ? samplingRate - wrapped : wrapped;
}

export function describeSamplingStatus(experimentState: ExperimentState) {
  const nyquist = experimentState.samplingRate / 2;
  const nyquistSatisfied = experimentState.signalFrequency <= nyquist;
  const alias = aliasFrequency(
    experimentState.signalFrequency,
    experimentState.samplingRate,
  );

  const observations = nyquistSatisfied
    ? [
        `当前采样率 ${experimentState.samplingRate.toFixed(1)} Hz 已满足 2f 条件。`,
        "采样点可以较稳定地描出连续信号的主要变化趋势。",
        "现在适合继续调振幅或噪声，观察重建曲线是否仍保持一致。",
      ]
    : [
        `当前采样率 ${experimentState.samplingRate.toFixed(1)} Hz 低于 2f，已进入混叠风险区。`,
        `学生可能会把 ${experimentState.signalFrequency.toFixed(1)} Hz 的真实信号误判为 ${alias.toFixed(2)} Hz 左右的低频信号。`,
        "这是最适合用来展示 AI 伴学和实验解释价值的关键现象。",
      ];

  return {
    label: nyquistSatisfied ? "可稳定重建" : "出现混叠",
    tone: nyquistSatisfied ? ("safe" as const) : ("risk" as const),
    nyquistSatisfied,
    aliasFrequency: alias,
    observations,
  };
}

function normalizeY(value: number) {
  return 210 - value * (118 / DISPLAY_RANGE);
}

function signalValue(
  time: number,
  experimentState: ExperimentState,
  frequency = experimentState.signalFrequency,
) {
  const pure =
    experimentState.amplitude * Math.sin(2 * Math.PI * frequency * time + experimentState.phase);
  const noise =
    experimentState.noiseLevel *
    Math.sin(2 * Math.PI * (frequency * 0.35 + 1.2) * time + experimentState.phase * 0.5);

  return pure + noise;
}

export function generateContinuousWave(experimentState: ExperimentState, pointCount = 260) {
  const points = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const time = (index / pointCount) * experimentState.duration;
    points.push({
      x: AXIS_LEFT + (index / pointCount) * AXIS_WIDTH,
      y: normalizeY(signalValue(time, experimentState)),
    });
  }

  return points;
}

export function generateReconstructedWave(experimentState: ExperimentState, pointCount = 260) {
  const reconstructedFrequency =
    experimentState.signalFrequency > experimentState.samplingRate / 2
      ? aliasFrequency(experimentState.signalFrequency, experimentState.samplingRate)
      : experimentState.signalFrequency;

  const points = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const time = (index / pointCount) * experimentState.duration;
    points.push({
      x: AXIS_LEFT + (index / pointCount) * AXIS_WIDTH,
      y: normalizeY(signalValue(time, experimentState, reconstructedFrequency)),
    });
  }

  return points;
}

export function generateSampledWave(experimentState: ExperimentState) {
  const safeSamplingRate = Math.max(experimentState.samplingRate, 1);
  const samplePeriod = 1 / safeSamplingRate;
  const points = [];

  for (let time = 0; time <= experimentState.duration + samplePeriod * 0.5; time += samplePeriod) {
    const clampedTime = Math.min(time, experimentState.duration);
    points.push({
      x: AXIS_LEFT + (clampedTime / experimentState.duration) * AXIS_WIDTH,
      y: normalizeY(signalValue(clampedTime, experimentState)),
    });
  }

  return points;
}

export function formatChartPoints(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function createSpectrumAnalysis(experimentState: ExperimentState): SpectrumAnalysis {
  const nyquist = experimentState.samplingRate / 2;
  const alias = aliasFrequency(
    experimentState.signalFrequency,
    experimentState.samplingRate,
  );
  const axisMax = 60;
  const ticks = Array.from({ length: 7 }, (_, index) => index * 10);
  const scaleX = (value: number) => 70 + (Math.min(value, axisMax) / axisMax) * 820;

  return {
    axisMax,
    ticks,
    markers: [
      {
        x: scaleX(experimentState.signalFrequency),
        y: 70,
        label: `原始 ${experimentState.signalFrequency.toFixed(1)}Hz`,
        color: "#2563eb",
      },
      {
        x: scaleX(nyquist),
        y: 112,
        label: `Nyquist ${nyquist.toFixed(1)}Hz`,
        color: "#f59e0b",
      },
      {
        x: scaleX(alias),
        y: 154,
        label: `混叠 ${alias.toFixed(2)}Hz`,
        color: "#f97316",
      },
      {
        x: scaleX(experimentState.samplingRate),
        y: 94,
        label: `fs ${experimentState.samplingRate.toFixed(1)}Hz`,
        color: "#111827",
      },
    ],
  };
}

export function generateStudentJourney(experimentState: ExperimentState) {
  const status = describeSamplingStatus(experimentState);

  return {
    highlights: [
      `本轮实验可视时间窗为 ${(experimentState.duration * 1000).toFixed(0)} ms，重点观察局部细节变化。`,
      `当前已设置 ${experimentState.samplingRate.toFixed(1)} Hz 采样率，${experimentState.signalFrequency.toFixed(1)} Hz 信号频率。`,
      status.nyquistSatisfied
        ? "学生已经进入满足 Nyquist 条件的区域，可继续比较噪声与振幅对重建的影响。"
        : "学生已经观察到混叠现象，适合追问“为什么看到的是低频错觉”。",
    ],
    recommendedAction: status.nyquistSatisfied
      ? "继续提升噪声强度或相位，比较采样点与重建曲线是否仍能追踪主趋势。"
      : "把采样率继续提高到 36 Hz 以上，再对比波形与频谱的变化。",
  };
}
