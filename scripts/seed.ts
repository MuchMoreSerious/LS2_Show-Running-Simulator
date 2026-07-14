import { db } from "@/lib/db/store";
import { seedDemoProject } from "@/lib/db/seed";

db.reset();
seedDemoProject();
console.log("✅ 시드 완료: CES 2027 Press Conference 샘플 프로젝트가 생성되었습니다.");
