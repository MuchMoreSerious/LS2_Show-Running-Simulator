import { db } from "@/lib/db/store";
import { getFileStorage } from "@/lib/storage";
import { extractText, inferFileType } from "./extract";
import { getAIProvider } from "@/lib/ai";
import { v4 as uuid } from "uuid";
import { HistoricalCase } from "@/types/models";

/**
 * 문서 처리 파이프라인: 업로드된 문서를 텍스트로 추출하고, 카테고리에 맞는
 * AI 구조화(또는 과거 사례 추출)를 실행한 뒤 "검토 필요" 상태로 남긴다.
 * (요구사항 §10 — AI 결과는 사용자 검토 전에는 정식 데이터로 저장하지 않는다.)
 */
export async function processDocument(documentId: string): Promise<void> {
  const doc = db.getDocument(documentId);
  if (!doc) throw new Error("문서를 찾을 수 없습니다.");

  db.updateDocument(documentId, { processingStatus: "extracting" });

  const fileType = inferFileType(doc.filename);
  if (!fileType) {
    db.updateDocument(documentId, { processingStatus: "error", errorMessage: `지원하지 않는 파일 형식입니다: ${doc.filename}` });
    return;
  }

  let buffer: Buffer;
  try {
    buffer = await getFileStorage().read(doc.storagePath);
  } catch {
    db.updateDocument(documentId, { processingStatus: "error", errorMessage: "저장된 파일을 읽을 수 없습니다." });
    return;
  }

  const extracted = await extractText(buffer, fileType);
  if (!extracted.ok) {
    db.updateDocument(documentId, { processingStatus: "error", errorMessage: extracted.error });
    return;
  }

  db.updateDocument(documentId, { extractedText: extracted.text, processingStatus: "analyzing" });

  const provider = getAIProvider();
  try {
    if (doc.documentCategory === "past_report" || doc.documentCategory === "incident_log") {
      const cases = await provider.extractHistoricalCases(extracted.text, doc.filename);
      const historicalCases: HistoricalCase[] = cases.map((c) => ({
        id: uuid(),
        sourceDocumentId: doc.id,
        eventType: c.eventType,
        situation: c.situation,
        rootCause: c.rootCause,
        response: c.immediateResponse,
        outcome: c.finalOutcome,
        severity: c.severity,
        preventable: c.preventable,
        prevention: c.preventionActions?.join("; "),
        relatedResources: c.relatedResources,
        tags: c.tags,
      }));
      db.addHistoricalCases(historicalCases);
      db.updateDocument(documentId, { processingStatus: "completed", analysisResult: { extractedCaseCount: historicalCases.length } });
    } else {
      const structure = await provider.structureDocument(extracted.text, doc.documentCategory, doc.filename);
      db.updateDocument(documentId, { processingStatus: "needs_review", analysisResult: structure });
    }
  } catch (err) {
    db.updateDocument(documentId, {
      processingStatus: "error",
      errorMessage: `AI 구조화 중 오류: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
