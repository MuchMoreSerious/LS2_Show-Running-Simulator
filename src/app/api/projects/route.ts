import { v4 as uuid } from "uuid";
import { db } from "@/lib/db/store";
import { Project } from "@/types/models";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { requireProfileId } from "@/lib/ownership";

export async function GET() {
  await ensureBootstrapped();
  const profileId = await requireProfileId();
  if (!profileId) return fail("로그인이 필요합니다.", 401);

  const projects = db.listProjects(profileId);
  const enriched = projects.map((p) => {
    const documents = db.listDocuments(p.id);
    const simulations = db.listSimulations(p.id);
    const lastSim = [...simulations].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
    return {
      ...p,
      documentCount: documents.length,
      documentsNeedingReview: documents.filter((d) => d.processingStatus === "needs_review").length,
      lastSimulationScore: lastSim?.status === "completed" ? lastSim.overallScore : null,
    };
  });
  return ok(enriched);
}

export async function POST(req: Request) {
  await ensureBootstrapped();
  const profileId = await requireProfileId();
  if (!profileId) return fail("로그인이 필요합니다.", 401);

  try {
    const body = await parseBody<Partial<Project>>(req);
    if (!body.name || !body.eventType || !body.eventDate) {
      return fail("행사명, 행사 유형, 행사 날짜는 필수입니다.");
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: uuid(),
      profileId,
      name: body.name,
      eventType: body.eventType,
      eventDate: body.eventDate,
      venue: body.venue ?? "",
      clientName: body.clientName ?? "",
      audienceSize: body.audienceSize ?? 0,
      importanceLevel: body.importanceLevel ?? "medium",
      safetySensitivity: body.safetySensitivity ?? "medium",
      keyPrograms: body.keyPrograms ?? [],
      keyPeople: body.keyPeople ?? [],
      keyEquipment: body.keyEquipment ?? [],
      readinessScore: 0,
      createdAt: now,
      updatedAt: now,
    };
    db.createProject(project);
    return ok(project, 201);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "프로젝트 생성 실패", 400);
  }
}
