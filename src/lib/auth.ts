import { cookies } from "next/headers";

/**
 * 가벼운 "진입 잠금" 수준의 인증. 엔터프라이즈급 계정 시스템이 아니라
 * 프로필(팀/개인) 간 프로젝트·문서·레슨런이 서로 섞이거나 노출되지 않도록
 * 막는 최소한의 장치다.
 *
 * Next.js 미들웨어는 Edge 런타임에서 실행되어 Node의 `crypto` 모듈을 쓸 수
 * 없다. 대신 Edge·Node 양쪽에서 동일하게 지원되는 Web Crypto API
 * (`crypto.subtle`, 전역 객체)만 사용해 미들웨어와 Route Handler가 같은
 * 서명 로직을 공유하도록 한다.
 */

const SESSION_COOKIE = "sr_session";
const SECRET = process.env.APP_SECRET || "showrunner-dev-secret-change-me";

if (!process.env.APP_SECRET && process.env.NODE_ENV === "production") {
  // 프로덕션에서는 반드시 고유한 값으로 설정해야 세션 위조를 막을 수 있다.
  console.warn("[auth] APP_SECRET 환경변수가 설정되지 않았습니다. 배포 시 반드시 고유한 값을 설정하세요.");
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 상수 시간 비교 (Node의 crypto.timingSafeEqual은 Edge 런타임에서 쓸 수 없어 직접 구현). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPin(pin: string): Promise<string> {
  return hmacHex(pin);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  const computed = await hmacHex(pin);
  return timingSafeEqualHex(computed, pinHash);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function sign(profileId: string): Promise<string> {
  return `${profileId}.${await hmacHex(profileId)}`;
}

async function verify(token: string): Promise<string | null> {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const profileId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmacHex(profileId);
  return timingSafeEqualHex(sig, expected) ? profileId : null;
}

/** 로그인/프로필 생성 성공 시 세션 쿠키를 설정한다. (Route Handler에서만 호출 가능) */
export async function setSessionCookie(profileId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await sign(profileId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** 현재 요청의 세션에서 profileId를 읽는다. Route Handler 전용 (next/headers 사용). */
export async function getSessionProfileId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verify(raw);
}

/** 미들웨어(Edge 런타임)에서 쿠키 원문 값을 검증할 때 사용하는 순수 함수. */
export async function verifySessionToken(token: string): Promise<string | null> {
  return verify(token);
}

export { SESSION_COOKIE };
