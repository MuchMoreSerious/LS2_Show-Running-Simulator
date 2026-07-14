"use client";

import { useState } from "react";
import { Panel, PanelHeader, Badge, Button, Spinner } from "@/components/ui";
import { RISK_CATEGORY_LABELS, EVIDENCE_LABELS } from "@/lib/labels";
import type { ProjectBundle } from "@/app/projects/[id]/page";

function gradeOf(score: number): { label: string; tone: "green" | "amber" | "red" } {
  if (score >= 16) return { label: "치명적", tone: "red" };
  if (score >= 11) return { label: "높음", tone: "red" };
  if (score >= 6) return { label: "보통", tone: "amber" };
  return { label: "낮음", tone: "green" };
}

export function RisksTab({ bundle, onChanged }: { bundle: ProjectBundle; onChanged: () => void }) {
  const [running, setRunning] = useState(false);
  const programs = new Map(bundle.programs.map((p) => [p.id, p]));
  const resources = new Map(bundle.resources.map((r) => [r.id, r]));

  const runDiagnosis = async () => {
    setRunning(true);
    await fetch(`/api/projects/${bundle.project.id}/risks`, { method: "POST" });
    setRunning(false);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-dim">
          타임테이블·자원·의존성 데이터를 기반으로 시간 충돌, 인력 중복, 준비 미완료, 대체안 미비 등을 진단합니다.
        </p>
        <Button onClick={runDiagnosis} disabled={running}>
          {running ? <Spinner /> : "위험 진단 실행"}
        </Button>
      </div>

      <Panel>
        <PanelHeader right={<span className="text-[11px] text-ink-dim">위험 점수 = 발생 가능성 × 영향도 × 발견 난이도 보정</span>}>
          위험 목록 ({bundle.risks.length})
        </PanelHeader>
        {bundle.risks.length === 0 ? (
          <p className="p-6 text-sm text-ink-dim">진단된 위험이 없습니다. 위험 진단을 실행하세요.</p>
        ) : (
          <ul>
            {bundle.risks.map((r, i) => {
              const grade = gradeOf(r.riskScore);
              const program = r.relatedProgramId ? programs.get(r.relatedProgramId) : undefined;
              const resource = r.relatedResourceId ? resources.get(r.relatedResourceId) : undefined;
              return (
                <li key={r.id} className={`px-4 py-4 ${i > 0 ? "border-t border-hairline" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={grade.tone}>{grade.label} · {r.riskScore}</Badge>
                        <Badge tone="dim">{RISK_CATEGORY_LABELS[r.category]}</Badge>
                        <span className="font-medium text-sm">{r.title}</span>
                      </div>
                      <p className="text-xs text-ink-dim mt-1.5">{r.description}</p>
                      <p className="text-[11px] text-ink-dim/70 mt-1.5">
                        발생 가능성 {r.probability}/5 · 영향도 {r.impact}/5 · 근거: {EVIDENCE_LABELS[r.evidenceType]}
                        {program && <> · 관련 프로그램: {program.title}</>}
                        {resource && <> · 관련 자원: {resource.name}</>}
                      </p>
                      {r.mitigation && (
                        <p className="text-xs text-cue-blue mt-1.5">권장 조치: {r.mitigation}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
