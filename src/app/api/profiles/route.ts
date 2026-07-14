import { v4 as uuid } from "uuid";
import { db } from "@/lib/db/store";
import { ok, fail, parseBody } from "@/lib/api-utils";
import { hashPin, isValidPinFormat, setSessionCookie } from "@/lib/auth";
import { ensureBootstrapped } from "@/lib/bootstrap";

/** 프로필 이름 목록만 공개 — PIN 해시 등 민감 정보는 절대 내려주지 않는다. */
export async function GET() {
  await ensureBootstrapped();
  const profiles = db.listProfiles().map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt }));
  return ok(profiles);
}

export async function POST(req: Request) {
  await ensureBootstrapped();
  const body = await parseBody<{ name: string; pin: string }>(req);
  const name = body.name?.trim();
  if (!name || name.length > 30) return fail("이름을 1~30자로 입력해주세요.");
  if (!isValidPinFormat(body.pin ?? "")) return fail("PIN은 숫자 4자리로 입력해주세요.");
  if (db.getProfileByName(name)) return fail("이미 사용 중인 이름입니다. 다른 이름을 선택해주세요.");

  const profile = {
    id: uuid(),
    name,
    pinHash: await hashPin(body.pin),
    createdAt: new Date().toISOString(),
  };
  db.createProfile(profile);
  await setSessionCookie(profile.id);
  return ok({ id: profile.id, name: profile.name }, 201);
}
