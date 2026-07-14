import { db } from "@/lib/db/store";
import { ok, fail } from "@/lib/api-utils";
import { getSessionProfileId } from "@/lib/auth";

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) return fail("로그인이 필요합니다.", 401);
  const profile = db.getProfile(profileId);
  if (!profile) return fail("로그인이 필요합니다.", 401);
  return ok({ id: profile.id, name: profile.name });
}
