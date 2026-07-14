import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

// 로그인 없이 접근 가능해야 하는 경로 (프로필 생성/로그인 자체와 정적 자산)
function isPublic(pathname: string): boolean {
  if (pathname === "/api/profiles") return true; // GET(목록)·POST(생성) 둘 다 공개
  if (pathname === "/api/profiles/login") return true;
  if (pathname === "/login") return true;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const profileId = token ? await verifySessionToken(token) : null;

  if (!profileId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
