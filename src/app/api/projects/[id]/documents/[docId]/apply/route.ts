import { v4 as uuid } from "uuid";
import { db } from "@/lib/db/store";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { EventProgram, Confidence } from "@/types/models";
import { requireOwnedProject } from "@/lib/ownership";

interface ReviewedProgram {
  title: string;
  programType: string;
  startTime: string;
  endTime: string;
  location: string;
  responsiblePersons?: string[];
  requiredResources?: string[];
  preconditions?: string[];
  backupPlans?: string[];
  decisionMaker?: string;
  failureImpact?: string;
  confidence?: number;
}

/**
 * 사용자 검토 완료 후 AI 구조화 결과를 정식 프로그램 데이터로 반영한다.
 * (요구사항 §10 — AI 결과는 사용자 검토 승인 전에는 정식 저장하지 않는다.)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id: projectId, docId } = await params;
  const owned = await requireOwnedProject(projectId);
  if ("error" in owned) return owned.error;

  const doc = db.getDocument(docId);
  if (!doc || doc.projectId !== projectId) return fail("문서를 찾을 수 없습니다.", 404);
  if (doc.processingStatus !== "needs_review") return fail("검토 대기 상태의 문서가 아닙니다.");

  const body = await parseBody<{ programs: ReviewedProgram[] }>(req);
  if (!Array.isArray(body.programs)) return fail("programs 배열이 필요합니다.");

  const existing = db.listPrograms(projectId);
  const maxSeq = existing.reduce((m, p) => Math.max(m, p.sequence), 0);

  const newPrograms: EventProgram[] = body.programs.map((p, i) => ({
    id: uuid(),
    projectId,
    title: p.title,
    programType: p.programType || "general",
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location || "",
    status: "planned",
    sequence: maxSeq + i + 1,
    responsiblePersons: p.responsiblePersons ?? [],
    requiredResources: p.requiredResources ?? [],
    preconditions: p.preconditions ?? [],
    backupPlans: p.backupPlans ?? [],
    decisionMaker: p.decisionMaker,
    failureImpact: p.failureImpact,
    sourceDocumentId: docId,
    confidence: toConfidence(p.confidence),
  }));

  db.replacePrograms(projectId, [...existing, ...newPrograms]);
  db.updateDocument(docId, { processingStatus: "completed" });
  return ok({ applied: newPrograms.length });
}

function toConfidence(score?: number): Confidence {
  if (score === undefined) return "ai_estimate";
  if (score >= 0.8) return "document_stated";
  if (score >= 0.5) return "cross_document_inference";
  return "ai_estimate";
}
