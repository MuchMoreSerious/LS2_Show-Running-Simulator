"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Panel, PanelHeader, Button, ErrorNote, Spinner, ScoreBar, scoreTone } from "@/components/ui";
import { SimulationReport } from "@/types/models";

export default function ReportPage() {
  const { simId } = useParams<{ simId: string }>();
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 아직 완료 처리되지 않았을 수 있으므로 POST(완료+생성)를 먼저 시도한다.
    fetch(`/api/simulations/${simId}/report`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("리포트를 생성하지 못했습니다."))))
      .then(setReport)
      .catch((e: Error) => setError(e.message));
  }, [simId]);

  if (error) return <ErrorNote message={error} />;
  if (!report) return <div className="py-20 text-center"><Spinner /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono tracking-[0.2em] text-ink-dim uppercase">Simulation Debrief</p>
          <h1 className="text-2xl font-bold mt-1">시뮬레이션 결과 리포트</h1>
          <p className="text-xs text-ink-dim mt-1 timecode">{new Date(report.generatedAt).toLocaleString("ko-KR")}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/simulations/${simId}/report?format=markdown`} download>
            <Button>Markdown 내보내기</Button>
          </a>
          <Link href={`/projects/${report.projectId}`}>
            <Button variant="ghost">프로젝트로</Button>
          </Link>
        </div>
      </div>

      {/* 종합 점수 */}
      <Panel className="p-6">
        <div className="grid sm:grid-cols-[auto_1fr] gap-8 items-center">
          <div className="text-center">
            <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase">종합 준비도</p>
            <p className="timecode text-6xl font-bold mt-1" style={{ color: report.overallScore >= 75 ? "var(--tally-green)" : report.overallScore >= 50 ? "var(--tally-amber)" : "var(--tally-red)" }}>
              {report.overallScore}
            </p>
            <p className="text-xs text-ink-dim mt-1">/ 100</p>
          </div>
          <div className="space-y-3">
            <ScoreLine label="일정 준수" value={report.scheduleScore} />
            <ScoreLine label="안전" value={report.safetyScore} />
            <ScoreLine label="연출 완성도" value={report.productionScore} />
            <ScoreLine label="고객 만족 예상" value={report.clientScore} />
            <ScoreLine label="비용 통제" value={report.costScore} />
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-dim">팀 피로도 (높을수록 부정적)</span>
                <span className="timecode">{report.fatigueScore}</span>
              </div>
              <ScoreBar value={report.fatigueScore} tone={report.fatigueScore >= 50 ? "red" : report.fatigueScore >= 25 ? "amber" : "green"} />
            </div>
          </div>
        </div>
      </Panel>

      {/* 취약 분석 */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="가장 취약한 구간" value={report.mostVulnerablePhase} />
        <StatCard label="가장 위험한 자원" value={report.riskiestResource} />
        <StatCard label="가장 반복된 문제" value={report.mostRepeatedIssue} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ListPanel title="잘한 대응" items={report.goodDecisions} tone="green" empty="이번 시뮬레이션에서 특별히 긍정적으로 평가된 대응이 없습니다." />
        <ListPanel title="위험했던 대응" items={report.riskyDecisions} tone="red" empty="위험하게 평가된 대응이 없습니다." />
      </div>

      <ListPanel title="행사 전 반드시 해결할 항목" items={report.mustFixBeforeEvent} tone="red" empty="치명적/높음 등급의 미해결 위험이 없습니다." />
      <ListPanel title="미확인 사항 (시뮬레이션에서 다루지 못한 상황)" items={report.unresolvedItems} tone="amber" empty="모든 상황을 처리했습니다." />

      <div className="grid md:grid-cols-2 gap-4">
        <ListPanel title="추천 추가 리허설" items={report.recommendedRehearsals} tone="blue" empty="-" />
        <ListPanel title="추천 체크리스트" items={report.recommendedChecklist} tone="blue" empty="-" />
      </div>

      <ListPanel title="실제 운영 매뉴얼 반영 제안" items={report.manualUpdateSuggestions} tone="dim" empty="-" />

      <p className="text-[11px] text-ink-dim/70 text-center pb-8">
        점수는 결과를 설명하기 위한 보조 수단입니다. 실제 행사 준비 판단은 반드시 담당자의 검토를 거쳐야 합니다.
      </p>
    </div>
  );
}

function ScoreLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-ink-dim">{label}</span>
        <span className="timecode">{value}</span>
      </div>
      <ScoreBar value={value} tone={scoreTone(value)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4">
      <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase">{label}</p>
      <p className="font-semibold mt-1.5 text-sm">{value}</p>
    </Panel>
  );
}

function ListPanel({ title, items, tone, empty }: { title: string; items: string[]; tone: "green" | "red" | "amber" | "blue" | "dim"; empty: string }) {
  const dot = { green: "tally-go", red: "tally-stop", amber: "tally-live", blue: "tally-idle", dim: "tally-idle" }[tone];
  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      {items.length === 0 ? (
        <p className="p-4 text-xs text-ink-dim">{empty}</p>
      ) : (
        <ul className="p-4 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <span className={`tally mt-1.5 ${dot}`} style={{ animation: "none" }} aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
