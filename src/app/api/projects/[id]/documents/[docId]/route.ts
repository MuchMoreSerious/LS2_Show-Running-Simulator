import { db } from "@/lib/db/store";
import { ok, fail } from "@/lib/api-utils";
import { requireOwnedProject } from "@/lib/ownership";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id: projectId, docId } = await params;
  const owned = await requireOwnedProject(projectId);
  if ("error" in owned) return owned.error;

  const doc = db.getDocument(docId);
  if (!doc || doc.projectId !== projectId) return fail("문서를 찾을 수 없습니다.", 404);
  return ok(doc);
}
