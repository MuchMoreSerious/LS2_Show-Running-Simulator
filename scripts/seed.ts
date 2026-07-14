import { db } from "@/lib/db/store";
import { seedDemoProject } from "@/lib/db/seed";

async function main() {
  db.reset();
  await seedDemoProject();
  console.log("✅ 시드 완료: 데모 프로필(이름 \"데모\", PIN 1234) + CES 2027 Press Conference 샘플 프로젝트가 생성되었습니다.");
}

main();
