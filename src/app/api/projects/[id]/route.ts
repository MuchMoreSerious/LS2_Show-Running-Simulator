import { db } from "@/lib/db/store";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { Project } from "@/types/models";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = db.getProject(id);
  if (!project) return fail("프로젝트를 찾을 수 없습니다.", 404);
  return ok({
    project,
    documents: db.listDocuments(id),
    programs: db.listPrograms(id),
    resources: db.listResources(id),
    dependencies: db.listDependencies(id),
    risks: db.listRisks(id),
    simulations: db.listSimulations(id),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patch = await parseBody<Partial<Project>>(req);
  const updated = db.updateProject(id, patch);
  if (!updated) return fail("프로젝트를 찾을 수 없습니다.", 404);
  return ok(updated);
}
