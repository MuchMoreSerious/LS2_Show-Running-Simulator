"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, PanelHeader, Badge, Button, Field, inputCls, ErrorNote, Spinner } from "@/components/ui";
import { DOC_CATEGORY_LABELS, PROCESSING_STATUS_LABELS } from "@/lib/labels";
import { DocumentCategory, ProcessingStatus, ProjectDocument } from "@/types/models";
import type { ProjectBundle } from "@/app/projects/[id]/page";
import type { DocumentStructureResult } from "@/lib/ai/provider";

// 서버(src/app/api/projects/[id]/documents/route.ts)와 동일한 값 — Render 무료
// 플랜(RAM 512MB)에서 큰 PDF 처리로 서버가 죽는 것을 클라이언트에서도 미리 방지
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const STATUS_TONE: Record<ProcessingStatus, "amber" | "green" | "red" | "blue" | "dim"> = {
  uploaded: "dim",
  extracting: "blue",
  analyzing: "blue",
  needs_review: "amber",
  completed: "green",
  error: "red",
};

export function DocumentsTab({ bundle, onChanged }: { bundle: ProjectBundle; onChanged: () => void }) {
  const projectId = bundle.project.id;
  const [category, setCategory] = useState<DocumentCategory>("manual");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewDoc, setReviewDoc] = useState<ProjectDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 처리 중 문서가 있으면 3초마다 새로고침
  const hasProcessing = bundle.documents.some((d) => d.processingStatus === "extracting" || d.processingStatus === "analyzing" || d.processingStatus === "uploaded");
  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(onChanged, 3000);
    return () => clearInterval(t);
  }, [hasProcessing, onChanged]);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("업로드할 파일을 선택하세요."); return; }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB). 최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB까지 업로드할 수 있습니다.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <Field label="문서 카테고리">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {Object.entries(DOC_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="파일 (PDF·DOCX·XLSX·CSV·TXT·MD, 최대 8MB)">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md" className={`${inputCls} file:mr-3 file:bg-booth-raised file:border-0 file:text-ink file:px-3 file:py-1 file:rounded file:text-xs`} />
          </Field>
          <Button variant="go" onClick={upload} disabled={uploading}>
            {uploading ? <Spinner /> : "업로드"}
          </Button>
        </div>
        {error && <div className="mt-3"><ErrorNote message={error} /></div>}
      </Panel>

      <Panel>
        <PanelHeader>업로드된 문서</PanelHeader>
        {bundle.documents.length === 0 ? (
          <p className="p-6 text-sm text-ink-dim">업로드된 문서가 없습니다.</p>
        ) : (
          <ul>
            {bundle.documents.map((d, i) => (
              <li key={d.id} className={`px-4 py-3 flex items-center gap-4 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{d.filename}</p>
                  <p className="text-[11px] text-ink-dim mt-0.5">
                    {DOC_CATEGORY_LABELS[d.documentCategory]} · <span className="timecode">{new Date(d.createdAt).toLocaleString("ko-KR")}</span>
                  </p>
                  {d.errorMessage && <p className="text-[11px] text-tally-red mt-1">{d.errorMessage}</p>}
                </div>
                <Badge tone={STATUS_TONE[d.processingStatus]}>
                  {(d.processingStatus === "extracting" || d.processingStatus === "analyzing") && <Spinner />}
                  <span className={d.processingStatus === "extracting" || d.processingStatus === "analyzing" ? "ml-1.5" : ""}>
                    {PROCESSING_STATUS_LABELS[d.processingStatus]}
                  </span>
                </Badge>
                {d.processingStatus === "needs_review" && (
                  <Button onClick={() => setReviewDoc(d)} className="text-xs px-3 py-1.5">검토하기</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {reviewDoc && (
        <StructureReviewModal
          projectId={projectId}
          doc={reviewDoc}
          onClose={() => setReviewDoc(null)}
          onApplied={() => { setReviewDoc(null); onChanged(); }}
        />
      )}
    </div>
  );
}

interface EditableProgram {
  title: string;
  programType: string;
  startTime: string;
  endTime: string;
  location: string;
  decisionMaker: string;
  confidence: number;
  include: boolean;
}

function StructureReviewModal({
  projectId, doc, onClose, onApplied,
}: { projectId: string; doc: ProjectDocument; onClose: () => void; onApplied: () => void }) {
  const [programs, setPrograms] = useState<EditableProgram[] | null>(null);
  const [meta, setMeta] = useState<Pick<DocumentStructureResult, "missingInformation" | "documentConflicts"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/documents/${doc.id}`)
      .then((r) => r.json())
      .then((d: ProjectDocument) => {
        const result = d.analysisResult as DocumentStructureResult | undefined;
        setPrograms(
          (result?.programs ?? []).map((p) => ({
            title: p.title, programType: p.programType, startTime: p.startTime, endTime: p.endTime,
            location: p.location, decisionMaker: p.decisionMaker ?? "", confidence: p.confidence, include: true,
          }))
        );
        setMeta({ missingInformation: result?.missingInformation ?? [], documentConflicts: result?.documentConflicts ?? [] });
      })
      .catch(() => setError("분석 결과를 불러오지 못했습니다."));
  }, [projectId, doc.id]);

  const setField = (i: number, key: keyof EditableProgram, value: string | boolean | number) =>
    setPrograms((ps) => ps!.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));

  const apply = async () => {
    if (!programs) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${doc.id}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programs: programs.filter((p) => p.include) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "반영 실패");
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "반영 실패");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <Panel className="w-full max-w-3xl p-6 space-y-4 max-h-[88vh] overflow-y-auto">
        <div>
          <h3 className="font-semibold">행사 구조 검토 — {doc.filename}</h3>
          <p className="text-xs text-ink-dim mt-1">
            AI가 문서에서 추출한 내용입니다. 잘못된 항목은 수정하고, 불필요한 항목은 체크를 해제하세요.
            <strong className="text-ink"> 검토를 완료해야 타임테이블에 반영됩니다.</strong>
          </p>
        </div>

        {error && <ErrorNote message={error} />}
        {!programs && !error && <div className="py-10 text-center"><Spinner /></div>}

        {meta && meta.documentConflicts.length > 0 && (
          <div className="bg-tally-amber/10 border border-tally-amber/30 rounded p-3 text-xs text-tally-amber space-y-1">
            <p className="font-semibold">문서 간 충돌 감지 — 최종 기준 정보를 직접 선택하세요</p>
            {meta.documentConflicts.map((c, i) => <p key={i}>· {c}</p>)}
          </div>
        )}
        {meta && meta.missingInformation.length > 0 && (
          <div className="bg-booth-inset border border-hairline rounded p-3 text-xs text-ink-dim space-y-1">
            <p className="font-semibold text-ink">누락된 정보</p>
            {meta.missingInformation.map((m, i) => <p key={i}>· {m}</p>)}
          </div>
        )}

        {programs && programs.length === 0 && (
          <p className="text-sm text-ink-dim">이 문서에서 프로그램을 추출하지 못했습니다. 문서에 시간 정보(HH:mm)가 포함되어 있는지 확인하세요.</p>
        )}

        {programs && programs.length > 0 && (
          <ul className="space-y-2">
            {programs.map((p, i) => (
              <li key={i} className={`border rounded p-3 ${p.include ? "border-hairline" : "border-hairline/40 opacity-50"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <input type="checkbox" checked={p.include} onChange={(e) => setField(i, "include", e.target.checked)} />
                  <Badge tone={p.confidence >= 0.8 ? "green" : p.confidence >= 0.5 ? "amber" : "red"}>
                    {p.confidence >= 0.8 ? "문서 명시" : p.confidence >= 0.5 ? "문서 간 추론" : "AI 추정"} · 신뢰도 {(p.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input className={inputCls} value={p.title} onChange={(e) => setField(i, "title", e.target.value)} placeholder="프로그램명" />
                  <input className={inputCls} value={p.startTime} onChange={(e) => setField(i, "startTime", e.target.value)} placeholder="시작 HH:mm" />
                  <input className={inputCls} value={p.endTime} onChange={(e) => setField(i, "endTime", e.target.value)} placeholder="종료 HH:mm" />
                  <input className={inputCls} value={p.location} onChange={(e) => setField(i, "location", e.target.value)} placeholder="장소" />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>나중에</Button>
          <Button variant="go" onClick={apply} disabled={saving || !programs || programs.filter((p) => p.include).length === 0}>
            {saving ? <Spinner /> : "검토 완료 · 타임테이블에 반영"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

/**
 * 서버가 정상 JSON 대신 빈 응답이나 HTML을 돌려줄 때(연결 중단, 서버 리소스
 * 부족으로 인한 프로세스 중단 등) 브라우저의 원문 파싱 에러 대신 사용자가
 * 이해할 수 있는 메시지를 보여준다.
 */
async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return "서버 응답이 비어 있습니다. 파일이 너무 크거나 처리 중 서버가 중단됐을 수 있습니다 — 더 작은 파일로 다시 시도해보세요.";
  }
  try {
    const parsed = JSON.parse(text);
    return parsed.error ?? "업로드 실패";
  } catch {
    return `업로드 실패 (서버 오류, 상태 코드 ${res.status})`;
  }
}
