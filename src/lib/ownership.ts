import { db } from "@/lib/db/store";
import { getSessionProfileId } from "@/lib/auth";
import { Project, Simulation } from "@/types/models";
import { fail } from "@/lib/api-utils";

/**
 * 현재 세션 프로필을 반환한다. 세션이 없으면 null.
 * (미들웨어가 페이지/대부분의 API 접근을 이미 막지만, Route Handler에서도
 * 이중으로 확인해 profileId 없이 데이터에 접근하는 경로가 생기지 않게 한다.)
 */
export async function requireProfileId(): Promise<string | null> {
  return getSessionProfileId();
}

/** 프로젝트를 조회하되, 현재 세션 프로필의 소유가 아니면 없는 것처럼 취급한다 (정보 노출 방지). */
export async function requireOwnedProject(projectId: string): Promise<{ profileId: string; project: Project } | { error: Response }> {
  const profileId = await requireProfileId();
  if (!profileId) return { error: fail("로그인이 필요합니다.", 401) };
  const project = db.getProject(projectId);
  if (!project || project.profileId !== profileId) {
    return { error: fail("프로젝트를 찾을 수 없습니다.", 404) };
  }
  return { profileId, project };
}

/** 시뮬레이션이 속한 프로젝트가 현재 세션 프로필 소유인지 확인한다. */
export async function requireOwnedSimulation(simId: string): Promise<{ profileId: string; simulation: Simulation } | { error: Response }> {
  const profileId = await requireProfileId();
  if (!profileId) return { error: fail("로그인이 필요합니다.", 401) };
  const sim = db.getSimulation(simId);
  if (!sim) return { error: fail("시뮬레이션을 찾을 수 없습니다.", 404) };
  const project = db.getProject(sim.projectId);
  if (!project || project.profileId !== profileId) {
    return { error: fail("시뮬레이션을 찾을 수 없습니다.", 404) };
  }
  return { profileId, simulation: sim };
}
