"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, ErrorNote, Spinner } from "@/components/ui";
import { EVENT_TYPE_LABELS } from "@/lib/labels";
import {
  Dependency, EventProgram, EventType, Project, ProjectDocument, Resource, Risk, Simulation,
} from "@/types/models";
import { TimetableTab } from "@/components/project/TimetableTab";
import { DocumentsTab } from "@/components/project/DocumentsTab";
import { RisksTab } from "@/components/project/RisksTab";
import { SimulationSetupTab } from "@/components/project/SimulationSetupTab";

export interface ProjectBundle {
  project: Project;
  documents: ProjectDocument[];
  programs: EventProgram[];
  resources: Resource[];
  dependencies: Dependency[];
  risks: Risk[];
  simulations: Simulation[];
}

type Tab = "timetable" | "documents" | "risks" | "simulate";

const TABS: { key: Tab; label: string }[] = [
  { key: "timetable", label: "타임테이블 · 구조" },
  { key: "documents", label: "문서" },
  { key: "risks", label: "사전 위험 진단" },
  { key: "simulate", label: "시뮬레이션" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("timetable");

  const reload = useCallback(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("프로젝트를 불러오지 못했습니다."))))
      .then(setBundle)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (error) return <ErrorNote message={error} />;
  if (!bundle) return <div className="py-20 text-center text-ink-dim"><Spinner /> <span className="ml-2 text-sm">불러오는 중…</span></div>;

  const { project } = bundle;
  const needsReview = bundle.documents.filter((d) => d.processingStatus === "needs_review").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs text-ink-dim hover:text-ink">← 프로젝트 목록</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge tone="dim">{EVENT_TYPE_LABELS[project.eventType as EventType] ?? project.eventType}</Badge>
          {project.safetySensitivity === "high" && <Badge tone="red">안전 민감도 높음</Badge>}
        </div>
        <p className="text-sm text-ink-dim mt-1">
          <span className="timecode">{project.eventDate}</span> · {project.venue} · 예상 관객 {project.audienceSize.toLocaleString()}명 · {project.clientName}
        </p>
      </div>

      <nav className="flex gap-1 border-b border-hairline" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-tally-amber text-ink font-medium"
                : "border-transparent text-ink-dim hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "documents" && needsReview > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-tally-amber/20 text-tally-amber text-[10px]">{needsReview}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === "timetable" && <TimetableTab bundle={bundle} onChanged={reload} />}
      {tab === "documents" && <DocumentsTab bundle={bundle} onChanged={reload} />}
      {tab === "risks" && <RisksTab bundle={bundle} onChanged={reload} />}
      {tab === "simulate" && <SimulationSetupTab bundle={bundle} />}
    </div>
  );
}
