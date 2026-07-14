import { db } from "@/lib/db/store";
import { seedDemoProject } from "@/lib/db/seed";

async function main() {
  db.reset();
  await seedDemoProject();
  console.log("✅ 시드 완료: 데모 프로필(이름 \"데모\", PIN 9999) + GV60 MAGMA 미디어 시승회 샘플 프로젝트가 생성되었습니다.");
}

main();
