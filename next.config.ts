import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse(pdfjs-dist)는 내부적으로 워커 스크립트(pdf.worker.mjs)를 동적 경로로 불러온다.
  // Next.js가 이 패키지를 번들링하면 워커 파일 경로가 깨져 "Cannot find module ...pdf.worker.mjs"
  // 오류가 발생한다. 서버 전용 외부 패키지로 지정해 Node의 기본 require로 그대로 로드하게 한다.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
