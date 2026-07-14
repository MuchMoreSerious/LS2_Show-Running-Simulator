import { db } from "@/lib/db/store";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { EventProgram } from "@/types/models";
import { requireOwnedProject } from "@/lib/ownership";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; programId: string }> }) {
  const { id: projectId, programId } = await params;
  const owned = await requireOwnedProject(projectId);
  if ("error" in owned) return owned.error;

  const patch = await parseBody<Partial<EventProgram>>(req);
  const updated = db.updateProgram(programId, patch);
  if (!updated) return fail("프로그램을 찾을 수 없습니다.", 404);
  return ok(updated);
}
