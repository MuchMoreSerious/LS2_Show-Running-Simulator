"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Field, inputCls, ErrorNote, Spinner } from "@/components/ui";

interface ProfileSummary { id: string; name: string; createdAt: string; }

export default function LoginPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null);
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 로그인 폼
  const [selected, setSelected] = useState<ProfileSummary | null>(null);
  const [pin, setPin] = useState("");

  // 생성 폼
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");

  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then(setProfiles).catch(() => setProfiles([]));
  }, []);

  const login = async () => {
    if (!selected) return;
    setError(null);
    if (!/^\d{4}$/.test(pin)) { setError("PIN 4자리를 입력해주세요."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/profiles/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: selected.id, pin }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "로그인 실패");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인 실패");
      setBusy(false);
    }
  };

  const create = async () => {
    setError(null);
    if (!newName.trim()) { setError("이름을 입력해주세요."); return; }
    if (!/^\d{4}$/.test(newPin)) { setError("PIN은 숫자 4자리로 입력해주세요."); return; }
    if (newPin !== newPinConfirm) { setError("PIN이 서로 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), pin: newPin }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "생성 실패");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="tally tally-live inline-block mb-3" aria-hidden />
          <h1 className="font-mono font-bold tracking-[0.2em] text-sm">SHOW-RUNNING SIMULATOR</h1>
          <p className="text-xs text-ink-dim mt-2">프로필을 선택하거나 새로 만들어 시작하세요.</p>
        </div>

        <Panel className="p-6 space-y-4">
          {error && <ErrorNote message={error} />}

          {mode === "pick" ? (
            <>
              {profiles === null ? (
                <div className="text-center py-6"><Spinner /></div>
              ) : profiles.length === 0 ? (
                <p className="text-sm text-ink-dim text-center py-4">아직 프로필이 없습니다. 새로 만들어주세요.</p>
              ) : selected ? (
                <>
                  <p className="text-sm">
                    <span className="font-medium">{selected.name}</span> 프로필의 PIN을 입력하세요.
                  </p>
                  <Field label="PIN (4자리)">
                    <input
                      type="password" inputMode="numeric" maxLength={4} className={inputCls + " text-center tracking-[0.5em]"}
                      value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => { if (e.key === "Enter") login(); }}
                      autoFocus
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setSelected(null); setPin(""); setError(null); }}>뒤로</Button>
                    <Button variant="go" onClick={login} disabled={busy} className="flex-1">{busy ? <Spinner /> : "로그인"}</Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="w-full text-left px-4 py-3 rounded bg-booth-inset border border-hairline hover:border-tally-amber/60 transition-colors text-sm"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {!selected && (
                <button onClick={() => { setMode("create"); setError(null); }} className="w-full text-xs text-ink-dim hover:text-ink pt-2">
                  + 새 프로필 만들기
                </button>
              )}
            </>
          ) : (
            <>
              <Field label="이름 (팀 또는 개인)">
                <input className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 라이브스페이스2팀" autoFocus />
              </Field>
              <Field label="PIN (숫자 4자리)" hint="이 프로필의 프로젝트와 레슨런에 접근할 때 사용합니다">
                <input type="password" inputMode="numeric" maxLength={4} className={inputCls + " text-center tracking-[0.5em]"} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="PIN 확인">
                <input
                  type="password" inputMode="numeric" maxLength={4} className={inputCls + " text-center tracking-[0.5em]"}
                  value={newPinConfirm} onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" onClick={() => { setMode("pick"); setError(null); }}>뒤로</Button>
                <Button variant="go" onClick={create} disabled={busy} className="flex-1">{busy ? <Spinner /> : "프로필 만들고 시작"}</Button>
              </div>
            </>
          )}
        </Panel>

        <p className="text-[11px] text-ink-dim/60 text-center mt-4">
          간단한 진입 잠금입니다 — 프로필별로 프로젝트와 레슨런이 서로 분리되어 보이지 않습니다.
        </p>
      </div>
    </div>
  );
}
