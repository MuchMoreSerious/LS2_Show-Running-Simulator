import { db } from "@/lib/db/store";
import { diagnoseRisks } from "@/lib/simulation/risk-diagnosis";
import { ok, fail } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ok(db.listRisks(id));
}

/** 프로그램/리소스 데이터를 기반으로 결정론적 위험 진단을 재실행한다.
 *  seed에서 만든 리스크 등 evidenceText가 있는 기존 리스크는 유지하고,
 *  자동 진단 결과를 병합한다 (제목 기준 중복 제거). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = db.getProject(id);
  if (!project) return fail("프로젝트를 찾을 수 없습니다.", 404);

  const programs = db.listPrograms(id);
  const resources = db.listResources(id);
  const dependencies = db.listDependencies(id);
  const documents = db.listDocuments(id);

  const diagnosed = diagnoseRisks(id, programs, resources, dependencies, documents);
  const existing = db.listRisks(id);
  const existingTitles = new Set(existing.map((r) => r.title));
  const merged = [...existing, ...diagnosed.filter((r) => !existingTitles.has(r.title))];
  db.replaceRisks(id, merged);

  const avgRisk = merged.length > 0 ? merged.reduce((s, r) => s + r.riskScore, 0) / merged.length : 0;
  db.updateProject(id, { readinessScore: Math.max(0, Math.round(100 - avgRisk * 3)) });

  return ok(db.listRisks(id));
}
