export type KnowledgeEntry = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  fileName: string;
  fileUrl: string;
  updatedAt: string;
};

export const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: "course-outline",
    title: "课程大纲与实验安排",
    category: "课程资料",
    tags: ["大纲", "实验安排", "教学计划"],
    fileName: "课程大纲与实验安排.txt",
    fileUrl: "/knowledge/course-outline.txt",
    updatedAt: "2026-04-24",
  },
  {
    id: "sampling-notes",
    title: "采样、混叠与重建讲义",
    category: "章节讲义",
    tags: ["采样", "混叠", "重建", "第一章"],
    fileName: "采样混叠与重建讲义.txt",
    fileUrl: "/knowledge/sampling-notes.txt",
    updatedAt: "2026-04-24",
  },
  {
    id: "dft-notes",
    title: "DFT 与频谱分析讲义",
    category: "章节讲义",
    tags: ["DFT", "频谱", "窗函数", "FFT"],
    fileName: "DFT与频谱分析讲义.txt",
    fileUrl: "/knowledge/dft-notes.txt",
    updatedAt: "2026-04-24",
  },
  {
    id: "filter-notes",
    title: "数字滤波实验单",
    category: "实验资料",
    tags: ["数字滤波", "低通", "高通", "截止频率"],
    fileName: "数字滤波实验单.txt",
    fileUrl: "/knowledge/filter-notes.txt",
    updatedAt: "2026-04-24",
  },
];
