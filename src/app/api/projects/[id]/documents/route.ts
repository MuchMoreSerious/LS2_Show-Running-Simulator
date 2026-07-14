import { v4 as uuid } from "uuid";
import { db } from "@/lib/db/store";
import { getFileStorage } from "@/lib/storage";
import { inferFileType } from "@/lib/documents/extract";
import { processDocument } from "@/lib/documents/pipeline";
import { ProjectDocument, DocumentCategory } from "@/types/models";
import { ok, fail } from "@/lib/api-utils";
import { requireOwnedProject } from "@/lib/ownership";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await requireOwnedProject(id);
  if ("error" in owned) return owned.error;
  return ok(db.listDocuments(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const owned = await requireOwnedProject(projectId);
  if ("error" in owned) return owned.error;

  const form = await req.formData();
  const file = form.get("file");
  const category = form.get("category") as DocumentCategory | null;
  if (!(file instanceof File)) return fail("업로드할 파일이 필요합니다.");
  if (!category) return fail("문서 카테고리를 지정해야 합니다.");

  const fileType = inferFileType(file.name);
  if (!fileType) {
    return fail(`지원하지 않는 파일 형식입니다. 지원 형식: PDF, DOCX, XLSX, CSV, TXT, Markdown (업로드한 파일: ${file.name})`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await getFileStorage().save(projectId, file.name, buffer);

  const doc: ProjectDocument = {
    id: uuid(),
    projectId,
    filename: file.name,
    fileType,
    documentCategory: category,
    storagePath,
    processingStatus: "uploaded",
    extractedText: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
  };
  db.createDocument(doc);

  // 비동기 처리 파이프라인 실행 (텍스트 추출 → AI 구조화). 완료를 기다리지 않고 상태로 진행 상황을 노출한다.
  processDocument(doc.id).catch((err) => {
    db.updateDocument(doc.id, { processingStatus: "error", errorMessage: err instanceof Error ? err.message : String(err) });
  });

  return ok(doc, 201);
}
