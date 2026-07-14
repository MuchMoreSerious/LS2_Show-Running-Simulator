"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelHeader, Button, ErrorNote, Spinner } from "@/components/ui";
import { DIFFICULTY_LABELS, FREQUENCY_LABELS, PHASE_LABELS_KO, RISK_CATEGORY_LABELS } from "@/lib/labels";
import { Difficulty, EventFrequency, RiskCategory, SimulationPhase } from "@/types/models";
import type { ProjectBundle } from "@/app/projects/[id]/page";

const ALL_PHASES = Object.keys(PHASE_LABELS_KO) as SimulationPhase[];
const ALL_CATEGORIES = Object.keys(RISK_CATEGORY_LABELS) as RiskCategory[];

export function SimulationSetupTab({ bundle }: { bundle: ProjectBundle }) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [frequency, setFrequency] = useState<EventFrequency>("normal");
  const [phases, setPhases] = useState<SimulationPhase[]>(["full_rehearsal", "pre_show", "show"]);
  const [categories, setCategories] = useState<RiskCategory[]>(ALL_CATEGORIES);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(list: T[], setList: (l: T[]) => void, item: T) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const start = async () => {
    setError(null);
    if (bundle.programs.length === 0) {
      setError("시뮬레이션을 시작하려면 타임테이블에 프로그램이 1개 이상 있어야 합니다.");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(`/api/projects/${bundle.project.id}/simulations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ difficulty, phases, eventFrequency: frequency, includedRiskCategories: categories }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "시작 실패");
      const sim = await res.json();
      router.push(`/simulations/${sim.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "시작 실패");
      setStarting(false);
    }
  };

  const completedSims = bundle.simulations.filter((s) => s.status === "completed");

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {error && <ErrorNote message={error} />}

        <Panel className="p-5 space-y-5">
          <SettingGroup label="난도">
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{DIFFICULTY_LABELS[d]}</Chip>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label="시뮬레이션 구간">
            <div className="flex gap-2 flex-wrap">
              {ALL_PHASES.map((p) => (
                <Chip key={p} active={phases.includes(p)} onClick={() => toggle(phases, setPhases, p)}>{PHASE_LABELS_KO[p]}</Chip>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label="상황 발생 빈도">
            <div className="flex gap-2">
              {(Object.keys(FREQUENCY_LABELS) as EventFrequency[]).map((f) => (
                <Chip key={f} active={frequency === f} onClick={() => setFrequency(f)}>{FREQUENCY_LABELS[f]}</Chip>
              ))}
            </div>
          </SettingGroup>

          <SettingGroup label={`포함할 리스크 (${categories.length}/${ALL_CATEGORIES.length})`}>
            <div className="flex gap-2 flex-wrap">
              {ALL_CATEGORIES.map((c) => (
                <Chip key={c} active={categories.includes(c)} onClick={() => toggle(categories, setCategories, c)}>
                  {RISK_CATEGORY_LABELS[c]}
                </Chip>
              ))}
            </div>
          </SettingGroup>

          <div className="pt-2">
            <Button variant="go" onClick={start} disabled={starting || phases.length === 0 || categories.length === 0} className="w-full py-3 text-base tracking-wider font-mono">
              {starting ? <Spinner /> : "STANDBY — 시뮬레이션 시작 (GO)"}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel className="h-fit">
        <PanelHeader>지난 시뮬레이션</PanelHeader>
        {completedSims.length === 0 ? (
          <p className="p-4 text-sm text-ink-dim">아직 완료된 시뮬레이션이 없습니다.</p>
        ) : (
          <ul>
            {completedSims.map((s, i) => (
              <li key={s.id} className={`px-4 py-3 ${i > 0 ? "border-t border-hairline" : ""}`}>
                <button
                  onClick={() => router.push(`/simulations/${s.id}/report`)}
                  className="w-full text-left hover:text-tally-amber transition-colors"
                >
                  <p className="text-sm">
                    종합 <span className="timecode">{s.overallScore}</span>점 · {DIFFICULTY_LABELS[s.difficulty]}
                  </p>
                  <p className="text-[11px] text-ink-dim mt-0.5 timecode">
                    {s.completedAt ? new Date(s.completedAt).toLocaleString("ko-KR") : "-"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-mono tracking-[0.15em] text-ink-dim uppercase mb-2">{label}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs border transition-colors ${
        active
          ? "bg-tally-amber/15 border-tally-amber/50 text-tally-amber"
          : "bg-booth-inset border-hairline text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
