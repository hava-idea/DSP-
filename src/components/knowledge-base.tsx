"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { knowledgeEntries } from "@/lib/knowledge-base";

export function KnowledgeBase() {
  const [query, setQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return knowledgeEntries;
    }

    return knowledgeEntries.filter((entry) =>
      [entry.title, entry.category, entry.fileName, ...entry.tags].some((field) =>
        field.toLowerCase().includes(normalized),
      ),
    );
  }, [query]);

  return (
    <main className="min-h-screen px-4 py-4 pb-8 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <section className="apple-card rounded-[36px] p-5 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="soft-pill inline-flex rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                返回
              </Link>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
                知识库
              </h1>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索资料"
              className="w-full max-w-[320px] rounded-full border border-white/80 bg-white/78 px-4 py-3 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-slate-400 focus:border-blue-200 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className="badge-surface rounded-[30px] border border-white/70 bg-white/78 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="soft-pill rounded-full px-3 py-1 text-xs font-medium text-slate-600">
                  {entry.category}
                </span>
                <span className="text-xs font-medium text-slate-400">{entry.updatedAt}</span>
              </div>

              <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
                {entry.title}
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="truncate text-sm text-slate-500">{entry.fileName}</span>
                <a
                  href={entry.fileUrl}
                  download
                  className="rounded-full bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900"
                >
                  下载
                </a>
              </div>
            </article>
          ))}
        </section>

        {filteredEntries.length === 0 ? (
          <section className="apple-card rounded-[30px] px-6 py-10 text-center text-sm text-slate-500">
            未找到相关资料
          </section>
        ) : null}
      </div>
    </main>
  );
}
