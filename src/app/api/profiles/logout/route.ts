import { ok } from "@/lib/api-utils";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return ok({ success: true });
}
