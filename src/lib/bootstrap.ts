import { db } from "@/lib/db/store";
import { seedDemoProject } from "@/lib/db/seed";

let bootstrapped = false;

/** 개발 서버가 seed를 실행하지 않고 바로 켜졌을 때도 샘플 프로젝트가 보이도록 보장한다. */
export function ensureBootstrapped(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    if (db.listProjects().length === 0) {
      seedDemoProject();
    }
  } catch {
    // 파일 시스템 접근 불가 등 — 무시하고 넘어간다 (API가 빈 목록을 반환).
  }
}
