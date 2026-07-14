import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Show-Running Simulator — AI 행사 데스크 리허설 시뮬레이터",
  description: "행사는 한 번뿐이지만, 시뮬레이션 안에서는 여러 번 실패할 수 있다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen">
        <header className="border-b border-hairline bg-booth-inset/60 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="tally tally-live" aria-hidden />
              <span className="font-mono font-bold tracking-[0.2em] text-sm">SHOW-RUNNING SIMULATOR</span>
            </Link>
            <p className="text-xs text-ink-dim hidden sm:block">
              행사는 한 번뿐이지만, 시뮬레이션 안에서는 여러 번 실패할 수 있다.
            </p>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
