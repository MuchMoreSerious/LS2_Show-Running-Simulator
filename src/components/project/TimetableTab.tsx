"use client";

import { useState } from "react";
import { Panel, PanelHeader, Badge, Button, Field, inputCls } from "@/components/ui";
import { CONFIDENCE_LABELS } from "@/lib/labels";
import { EventProgram } from "@/types/models";
import type { ProjectBundle } from "@/app/projects/[id]/page";

const CONFIDENCE_TONE = {
  document_stated: "green",
  cross_document_inference: "amber",
  ai_estimate: "red",
} as const;

export function TimetableTab({ bundle, onChanged }: { bundle: ProjectBundle; onChanged: () => void }) {
  const { programs, resources } = bundle;
  const [editing, setEditing] = useState<EventProgram | null>(null);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Panel>
          <PanelHeader>행사 타임테이블 — 큐시트</PanelHeader>
          {programs.length === 0 ? (
            <p className="p-6 text-sm text-ink-dim">
              프로그램이 아직 없습니다. 문서 탭에서 타임테이블 문서를 업로드하고 검토를 완료하면 이곳에 반영됩니다.
            </p>
          ) : (
            <ul>
              {programs.map((p, i) => (
                <li key={p.id} className={`px-4 py-3 flex items-start gap-4 ${i > 0 ? "border-t border-hairline" : ""}`}>
                  <span className="timecode text-sm text-tally-amber w-24 shrink-0 pt-0.5">
                    {p.startTime}–{p.endTime}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.title}</span>
                      <Badge tone={CONFIDENCE_TONE[p.confidence]}>{CONFIDENCE_LABELS[p.confidence]}</Badge>
                    </div>
                    <p className="text-xs text-ink-dim mt-1">
                      {p.location}
                      {p.responsiblePersons.length > 0 && <> · 담당: {p.responsiblePersons.join(", ")}</>}
                      {p.decisionMaker && <> · 의사결정: {p.decisionMaker}</>}
                    </p>
                    {p.preconditions.length > 0 && (
                      <p className="text-xs text-ink-dim/80 mt-0.5">선행 조건: {p.preconditions.join(" / ")}</p>
                    )}
                    {p.backupPlans.length === 0 && (
                      <p className="text-[11px] text-tally-amber/80 mt-0.5">⚠ 대체안 미비</p>
                    )}
                  </div>
                  <Button variant="ghost" onClick={() => setEditing(p)} className="text-xs px-2 py-1">수정</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <PanelHeader>주요 자원</PanelHeader>
          <ul>
            {resources.map((r, i) => (
              <li key={r.id} className={`px-4 py-2.5 flex items-center gap-3 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <span
                  className={`tally ${r.status === "ready" ? "tally-go" : r.status === "at_risk" ? "tally-stop" : "tally-idle"}`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{r.name}</p>
                  <p className="text-[11px] text-ink-dim">
                    {r.resourceType} · {statusLabel(r.status)}
                    {r.criticality === "critical" && " · 핵심"}
                    {!r.backupAvailable && r.criticality !== "low" && " · 백업 없음"}
                  </p>
                </div>
              </li>
            ))}
            {resources.length === 0 && <li className="p-4 text-sm text-ink-dim">등록된 자원이 없습니다.</li>}
          </ul>
        </Panel>
      </div>

      {editing && (
        <ProgramEditModal
          program={editing}
          projectId={bundle.project.id}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function statusLabel(s: string): string {
  return { ready: "준비 완료", pending: "준비 중", at_risk: "위험", unavailable: "사용 불가" }[s] ?? s;
}

function ProgramEditModal({
  program, projectId, onClose, onSaved,
}: { program: EventProgram; projectId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: program.title,
    startTime: program.startTime,
    endTime: program.endTime,
    location: program.location,
    responsiblePersons: program.responsiblePersons.join(", "),
    decisionMaker: program.decisionMaker ?? "",
    preconditions: program.preconditions.join(", "),
    backupPlans: program.backupPlans.join(", "),
    failureImpact: program.failureImpact ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/programs/${program.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        responsiblePersons: splitList(form.responsiblePersons),
        decisionMaker: form.decisionMaker || undefined,
        preconditions: splitList(form.preconditions),
        backupPlans: splitList(form.backupPlans),
        failureImpact: form.failureImpact || undefined,
        // 사용자가 직접 수정·확인한 항목은 문서 명시 수준의 신뢰도로 승격한다.
        confidence: "document_stated",
      }),
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <Panel className="w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold">프로그램 수정</h3>
        <Field label="프로그램명"><input className={inputCls} value={form.title} onChange={set("title")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작 (HH:mm)"><input className={inputCls} value={form.startTime} onChange={set("startTime")} /></Field>
          <Field label="종료 (HH:mm)"><input className={inputCls} value={form.endTime} onChange={set("endTime")} /></Field>
        </div>
        <Field label="장소"><input className={inputCls} value={form.location} onChange={set("location")} /></Field>
        <Field label="담당자" hint="쉼표로 구분"><input className={inputCls} value={form.responsiblePersons} onChange={set("responsiblePersons")} /></Field>
        <Field label="의사결정권자"><input className={inputCls} value={form.decisionMaker} onChange={set("decisionMaker")} /></Field>
        <Field label="선행 조건" hint="쉼표로 구분"><input className={inputCls} value={form.preconditions} onChange={set("preconditions")} /></Field>
        <Field label="대체안" hint="쉼표로 구분"><input className={inputCls} value={form.backupPlans} onChange={set("backupPlans")} /></Field>
        <Field label="실패 시 영향"><input className={inputCls} value={form.failureImpact} onChange={set("failureImpact")} /></Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="go" onClick={save} disabled={saving}>저장</Button>
        </div>
      </Panel>
    </div>
  );
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
