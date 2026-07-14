"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Panel, PanelHeader, Badge, Button, ErrorNote, Spinner, ScoreBar, scoreTone, inputCls } from "@/components/ui";
import { RISK_CATEGORY_LABELS } from "@/lib/labels";
import {
  Decision, EventProgram, Resource, RiskCategory, Scenario, Simulation,
} from "@/types/models";

interface SimBundle {
  simulation: Simulation;
  scenarios: Scenario[];
  decisions: Decision[];
  programs: EventProgram[];
  resources: Resource[];
  phaseWindows: { phase: string; label: string; start: string; end: string }[];
  progress: number;
}

const SEVERITY_TONE = { low: "dim", medium: "blue", high: "amber", critical: "red" } as const;
const SEVERITY_LABEL = { low: "낮음", medium: "보통", high: "높음", critical: "치명적" } as const;
const SOURCE_LABEL = {
  deterministic_data: "데이터 기반 필연적 상황",
  probabilistic: "확률적 돌발상황",
  historical_case: "과거 사례 기반 상황",
  chain_reaction: "연쇄 상황",
} as const;

export default function SimulationPage() {
  const { simId } = useParams<{ simId: string }>();
  const router = useRouter();
  const [bundle, setBundle] = useState<SimBundle | null>(null);
  const [active, setActive] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customResponse, setCustomResponse] = useState("");
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/simulations/${simId}`);
    if (!res.ok) { setError("시뮬레이션을 불러오지 못했습니다."); return null; }
    const data: SimBundle = await res.json();
    setBundle(data);
    return data;
  }, [simId]);

  const advance = useCallback(async () => {
    setLastDecision(null);
    const res = await fetch(`/api/simulations/${simId}/next`, { method: "POST" });
    if (!res.ok) { setError("다음 상황을 불러오지 못했습니다."); return; }
    const data: { scenario: Scenario | null; finished: boolean } = await res.json();
    if (data.finished) {
      // 모든 상황 종료 → 리포트 생성으로 이동
      await fetch(`/api/simulations/${simId}/report`, { method: "POST" });
      router.push(`/simulations/${simId}/report`);
      return;
    }
    setActive(data.scenario);
    setCustomResponse("");
    await reload();
  }, [simId, reload, router]);

  useEffect(() => {
    (async () => {
      const data = await reload();
      if (!data) return;
      if (data.simulation.status === "completed") {
        router.replace(`/simulations/${simId}/report`);
        return;
      }
      const activeScenario = data.scenarios.find((s) => s.status === "active");
      if (activeScenario) setActive(activeScenario);
      else await advance();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (optionId?: string) => {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/simulations/${simId}/decisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenarioId: active.id,
          selectedOptionId: optionId,
          customResponse: optionId ? undefined : customResponse,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "처리 실패");
      const data: { decision: Decision; simulation: Simulation } = await res.json();
      setLastDecision(data.decision);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const endNow = async () => {
    await fetch(`/api/simulations/${simId}/report`, { method: "POST" });
    router.push(`/simulations/${simId}/report`);
  };

  if (error && !bundle) return <ErrorNote message={error} />;
  if (!bundle) return <div className="py-20 text-center"><Spinner /></div>;

  const sim = bundle.simulation;
  const currentProgram = findCurrentProgram(bundle.programs, sim.currentTime);
  const scenarioMap = new Map(bundle.scenarios.map((s) => [s.id, s]));

  return (
    <div className="space-y-4 -mt-2">
      {/* ── 상단 상태바 ───────────────────────────── */}
      <Panel className="px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase">현재 시각</p>
          <p className="timecode text-2xl text-tally-amber leading-tight">{sim.currentTime}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase">현재 프로그램</p>
          <p className="text-sm truncate">{currentProgram?.title ?? "프로그램 대기 중"}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase">행사 종료까지</p>
          <p className="timecode text-sm">{remainingToEnd(bundle.programs, sim.currentTime)}</p>
        </div>
        <div className="flex-1 min-w-[140px]">
          <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase mb-1.5">전체 진행률 {bundle.progress}%</p>
          <ScoreBar value={bundle.progress} tone="amber" />
        </div>
        <Button variant="ghost" onClick={endNow} className="text-xs">시뮬레이션 종료</Button>
      </Panel>

      <div className="grid lg:grid-cols-[240px_1fr_220px] gap-4 items-start">
        {/* ── 좌측: 타임테이블 ───────────────────── */}
        <Panel className="max-h-[75vh] overflow-y-auto">
          <PanelHeader>타임테이블</PanelHeader>
          <ul>
            {bundle.programs.map((p, i) => {
              const state = programState(p, sim.currentTime);
              return (
                <li key={p.id} className={`px-3 py-2.5 flex items-start gap-2.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
                  <span className={`tally mt-1 ${state === "in_progress" ? "tally-live" : state === "completed" ? "tally-go" : "tally-idle"}`} aria-hidden />
                  <div className="min-w-0">
                    <p className={`text-xs ${state === "in_progress" ? "text-tally-amber font-medium" : state === "completed" ? "text-ink-dim line-through" : ""}`}>{p.title}</p>
                    <p className="timecode text-[10px] text-ink-dim">{p.startTime}–{p.endTime}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* ── 중앙: 상황 카드 ────────────────────── */}
        <div className="space-y-4">
          {error && <ErrorNote message={error} />}

          {active && (
            <Panel className="border-tally-amber/40">
              <div className="px-5 py-4 border-b border-hairline flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Badge tone={SEVERITY_TONE[active.severity]}>중요도 {SEVERITY_LABEL[active.severity]}</Badge>
                    <Badge tone="dim">{active.category === "chain" ? "연쇄 리스크" : RISK_CATEGORY_LABELS[active.category as RiskCategory]}</Badge>
                    <Badge tone="blue">{SOURCE_LABEL[active.sourceType]}</Badge>
                  </div>
                  <h2 className="font-semibold text-lg">{active.title}</h2>
                </div>
                {!lastDecision && (
                  <DecisionTimer key={active.id} limitSec={active.decisionTimeLimitSec} />
                )}
              </div>

              <div className="px-5 py-4 space-y-4">
                <p className="text-sm leading-relaxed whitespace-pre-line">{active.description}</p>

                {(active.peopleInvolved?.length || active.equipmentInvolved?.length) ? (
                  <p className="text-xs text-ink-dim">
                    {active.peopleInvolved?.length ? <>관련 인물: {active.peopleInvolved.join(", ")}</> : null}
                    {active.peopleInvolved?.length && active.equipmentInvolved?.length ? " · " : null}
                    {active.equipmentInvolved?.length ? <>관련 장비: {active.equipmentInvolved.join(", ")}</> : null}
                  </p>
                ) : null}

                {!lastDecision ? (
                  <>
                    <div className="space-y-2">
                      {active.options.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => decide(o.id)}
                          disabled={submitting}
                          className="w-full text-left flex items-start gap-3 bg-booth-inset border border-hairline hover:border-tally-amber/60 rounded p-3 transition-colors disabled:opacity-40"
                        >
                          <span className="timecode text-tally-amber font-bold shrink-0">{o.label}.</span>
                          <span className="text-sm">{o.description}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={inputCls}
                        placeholder="직접 대응안을 입력하세요 (예: 클라이언트에게 즉시 공유하고 큐 순서를 조정한다)"
                        value={customResponse}
                        onChange={(e) => setCustomResponse(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && customResponse.trim()) decide(); }}
                      />
                      <Button onClick={() => decide()} disabled={submitting || !customResponse.trim()}>실행</Button>
                    </div>
                    <p className="text-[11px] text-ink-dim/70">
                      선택 전에는 정확한 점수 영향이 공개되지 않습니다 — 실제 현장처럼 판단하세요.
                    </p>
                  </>
                ) : (
                  <DecisionResult decision={lastDecision} onNext={advance} />
                )}
              </div>
            </Panel>
          )}

          {!active && !lastDecision && (
            <Panel className="p-10 text-center text-ink-dim text-sm">
              <Spinner /> <span className="ml-2">다음 상황 준비 중…</span>
            </Panel>
          )}

          {/* ── 하단: 상황 로그 ─────────────────── */}
          <Panel>
            <PanelHeader>상황 로그</PanelHeader>
            {bundle.decisions.length === 0 ? (
              <p className="p-4 text-xs text-ink-dim">아직 처리한 상황이 없습니다.</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {[...bundle.decisions].reverse().map((d, i) => {
                  const sc = scenarioMap.get(d.scenarioId);
                  return (
                    <li key={d.id} className={`px-4 py-3 text-xs ${i > 0 ? "border-t border-hairline" : ""}`}>
                      <p>
                        <span className="timecode text-ink-dim">{sc?.triggerTime}</span>{" "}
                        <span className="font-medium">{sc?.title}</span>
                      </p>
                      <p className="text-ink-dim mt-1">→ {d.evaluation?.immediateResult}</p>
                      <p className="text-ink-dim/70 mt-0.5">
                        {formatEffects(d.scoreChange)}
                        {d.evaluation?.evidence?.[0] && <> · 근거: {d.evaluation.evidence[0].label}</>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── 우측: 점수판 ──────────────────────── */}
        <Panel className="sticky top-20">
          <PanelHeader>현재 점수</PanelHeader>
          <div className="p-4 space-y-4">
            <div className="text-center pb-3 border-b border-hairline">
              <p className="text-[10px] font-mono tracking-[0.15em] text-ink-dim uppercase">종합 준비도</p>
              <p className="timecode text-4xl font-bold mt-1" style={{ color: sim.overallScore >= 75 ? "var(--tally-green)" : sim.overallScore >= 50 ? "var(--tally-amber)" : "var(--tally-red)" }}>
                {sim.overallScore}
              </p>
            </div>
            <ScoreRow label="일정 준수율" value={sim.scheduleScore} />
            <ScoreRow label="안전성" value={sim.safetyScore} />
            <ScoreRow label="연출 완성도" value={sim.productionScore} />
            <ScoreRow label="클라이언트 만족도" value={sim.clientScore} />
            <ScoreRow label="비용 통제" value={sim.costScore} />
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-ink-dim">팀 피로도</span>
                <span className="timecode">{sim.fatigueScore}</span>
              </div>
              <ScoreBar value={sim.fatigueScore} tone={sim.fatigueScore >= 50 ? "red" : sim.fatigueScore >= 25 ? "amber" : "green"} />
              <p className="text-[10px] text-ink-dim/60 mt-1">높을수록 부정적</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** 판단 제한 시간 타이머. 초과해도 강제 종료하지 않는다 — 데스크 리허설 도구이므로 경고만.
 *  상황이 바뀌면 key로 재마운트되어 초기값이 재설정된다. */
function DecisionTimer({ limitSec }: { limitSec: number }) {
  const [timeLeft, setTimeLeft] = useState(limitSec);
  useEffect(() => {
    const t = setInterval(() => setTimeLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={`text-right ${timeLeft <= 15 ? "text-tally-red" : "text-ink-dim"}`}>
      <p className="text-[10px] font-mono tracking-[0.15em] uppercase">판단 제한</p>
      <p className="timecode text-xl">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</p>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-ink-dim">{label}</span>
        <span className="timecode">{value}</span>
      </div>
      <ScoreBar value={value} tone={scoreTone(value)} />
    </div>
  );
}

function DecisionResult({ decision, onNext }: { decision: Decision; onNext: () => void }) {
  const ev = decision.evaluation;
  return (
    <div className="space-y-3">
      <div className="bg-booth-inset border border-hairline rounded p-4 space-y-2 text-sm">
        <p className="font-medium">{ev?.immediateResult}</p>
        <ul className="text-xs text-ink-dim space-y-1">
          <li>· {ev?.scheduleImpact}</li>
          <li>· {ev?.safetyImpact}</li>
          <li>· {ev?.productionImpact}</li>
          <li>· {ev?.costImpact}</li>
        </ul>
        {ev?.newRisks && ev.newRisks.length > 0 && (
          <div className="pt-2 border-t border-hairline">
            <p className="text-xs text-tally-red font-medium">새롭게 발생한 위험</p>
            {ev.newRisks.map((r, i) => <p key={i} className="text-xs text-tally-red/80 mt-0.5">⚠ {r}</p>)}
          </div>
        )}
        {ev?.betterAlternative && (
          <p className="text-xs text-cue-blue pt-2 border-t border-hairline">💡 {ev.betterAlternative}</p>
        )}
        <p className="text-[10px] text-ink-dim/60 pt-1">
          근거: {ev?.evidence.map((e) => e.label).join(", ")}
        </p>
      </div>
      <Button variant="go" onClick={onNext} className="w-full font-mono tracking-wider">다음 상황으로 (GO)</Button>
    </div>
  );
}

function formatEffects(e: Decision["scoreChange"]): string {
  const parts: string[] = [];
  const names: Record<string, string> = { schedule: "일정", safety: "안전", production: "연출", client: "고객", cost: "비용", fatigue: "피로" };
  for (const [k, v] of Object.entries(e)) {
    if (v !== 0) parts.push(`${names[k]}${v > 0 ? "+" : ""}${v}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "점수 변화 없음";
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function findCurrentProgram(programs: EventProgram[], time: string): EventProgram | undefined {
  const t = toMin(time);
  return programs.find((p) => toMin(p.startTime) <= t && t < toMin(p.endTime));
}

function programState(p: EventProgram, time: string): "completed" | "in_progress" | "planned" {
  const t = toMin(time);
  if (t >= toMin(p.endTime)) return "completed";
  if (t >= toMin(p.startTime)) return "in_progress";
  return "planned";
}

function remainingToEnd(programs: EventProgram[], time: string): string {
  if (programs.length === 0) return "--:--";
  const end = Math.max(...programs.map((p) => toMin(p.endTime)));
  const diff = end - toMin(time);
  if (diff <= 0) return "종료";
  return `${Math.floor(diff / 60)}시간 ${diff % 60}분`;
}
