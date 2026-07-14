import { db } from "@/lib/db/store";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { verifyPin, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await parseBody<{ profileId: string; pin: string }>(req);
  const profile = db.getProfile(body.profileId ?? "");
  if (!profile) return fail("프로필을 찾을 수 없습니다.", 404);
  if (!(await verifyPin(body.pin ?? "", profile.pinHash))) return fail("PIN이 올바르지 않습니다.", 401);

  await setSessionCookie(profile.id);
  return ok({ id: profile.id, name: profile.name });
}
