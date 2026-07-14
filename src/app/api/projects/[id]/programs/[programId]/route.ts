import { db } from "@/lib/db/store";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { EventProgram } from "@/types/models";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; programId: string }> }) {
  const { programId } = await params;
  const patch = await parseBody<Partial<EventProgram>>(req);
  const updated = db.updateProgram(programId, patch);
  if (!updated) return fail("프로그램을 찾을 수 없습니다.", 404);
  return ok(updated);
}
