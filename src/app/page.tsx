"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, Badge, Button, Spinner, ErrorNote, ScoreBar, scoreTone } from "@/components/ui";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import { EventType, Project } from "@/types/models";

interface ProjectListItem extends Project {
  documentCount: number;
  documentsNeedingReview: number;
  lastSimulationScore: number | null;
}

export default function ProjectListPage() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("프로젝트 목록을 불러오지 못했습니다."))))
      .then(setProjects)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">행사 프로젝트</h1>
          <p className="text-sm text-ink-dim mt-1">
            운영 매뉴얼을 업로드하고, 본 행사 전에 데스크 리허설로 먼저 실패해 보세요.
          </p>
        </div>
        <Link href="/projects/new">
          <Button variant="go">+ 새 행사 프로젝트</Button>
        </Link>
      </div>

      {error && <ErrorNote message={error} />}
      {!projects && !error && (
        <div className="py-20 text-center text-ink-dim"><Spinner /> <span className="ml-2 text-sm">불러오는 중…</span></div>
      )}

      {projects && projects.length === 0 && (
        <Panel className="p-10 text-center text-ink-dim text-sm">
          아직 프로젝트가 없습니다. 새 행사 프로젝트를 만들어 시작하세요.
        </Panel>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block group">
              <Panel className="p-5 hover:border-tally-amber/50 transition-colors h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold group-hover:text-tally-amber transition-colors">{p.name}</h2>
                    <p className="text-xs text-ink-dim mt-1">
                      {EVENT_TYPE_LABELS[p.eventType as EventType] ?? p.eventType} · <span className="timecode">{p.eventDate}</span>
                    </p>
                  </div>
                  {p.documentsNeedingReview > 0 && <Badge tone="amber">검토 필요 {p.documentsNeedingReview}</Badge>}
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-ink-dim mb-1">
                      <span>준비도 점수</span>
                      <span className="timecode">{p.readinessScore}</span>
                    </div>
                    <ScoreBar value={p.readinessScore} tone={scoreTone(p.readinessScore)} />
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-ink-dim">
                    <span>문서 {p.documentCount}건</span>
                    <span>
                      최근 시뮬레이션:{" "}
                      {p.lastSimulationScore !== null ? (
                        <span className="timecode text-ink">{p.lastSimulationScore}점</span>
                      ) : (
                        "기록 없음"
                      )}
                    </span>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
