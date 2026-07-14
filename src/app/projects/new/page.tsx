"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Button, Field, inputCls, ErrorNote, Spinner } from "@/components/ui";
import { EVENT_TYPE_LABELS } from "@/lib/labels";

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    eventType: "corporate_press_conference",
    eventDate: "",
    venue: "",
    audienceSize: "",
    clientName: "",
    keyPrograms: "",
    keyPeople: "",
    keyEquipment: "",
    importanceLevel: "medium",
    safetySensitivity: "medium",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError(null);
    if (!form.name || !form.eventDate) {
      setError("행사명과 행사 날짜는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          audienceSize: form.audienceSize ? Number(form.audienceSize) : 0,
          keyPrograms: splitList(form.keyPrograms),
          keyPeople: splitList(form.keyPeople),
          keyEquipment: splitList(form.keyEquipment),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "생성 실패");
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">새 행사 프로젝트</h1>
      {error && <ErrorNote message={error} />}
      <Panel className="p-6 space-y-5">
        <Field label="행사명 *">
          <input className={inputCls} value={form.name} onChange={set("name")} placeholder="예: CES 2027 Press Conference" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="행사 유형 *">
            <select className={inputCls} value={form.eventType} onChange={set("eventType")}>
              {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="행사 날짜 *">
            <input type="date" className={inputCls} value={form.eventDate} onChange={set("eventDate")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="장소">
            <input className={inputCls} value={form.venue} onChange={set("venue")} placeholder="예: COEX Hall A" />
          </Field>
          <Field label="예상 관객 수">
            <input type="number" className={inputCls} value={form.audienceSize} onChange={set("audienceSize")} placeholder="예: 800" />
          </Field>
        </div>
        <Field label="클라이언트명">
          <input className={inputCls} value={form.clientName} onChange={set("clientName")} />
        </Field>
        <Field label="주요 프로그램" hint="쉼표로 구분해 입력하세요">
          <textarea className={inputCls} rows={2} value={form.keyPrograms} onChange={set("keyPrograms")} placeholder="예: 오프닝 영상, CEO 발표, 포토세션" />
        </Field>
        <Field label="주요 등장 인물" hint="쉼표로 구분">
          <input className={inputCls} value={form.keyPeople} onChange={set("keyPeople")} placeholder="예: CEO, MC, 무대 감독" />
        </Field>
        <Field label="주요 장비" hint="쉼표로 구분">
          <input className={inputCls} value={form.keyEquipment} onChange={set("keyEquipment")} placeholder="예: 메인 LED, 무선 마이크" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="행사 중요도">
            <select className={inputCls} value={form.importanceLevel} onChange={set("importanceLevel")}>
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
              <option value="critical">매우 높음</option>
            </select>
          </Field>
          <Field label="안전 민감도" hint="높음 선택 시 안전 항목의 평가 가중치가 40%까지 올라갑니다">
            <select className={inputCls} value={form.safetySensitivity} onChange={set("safetySensitivity")}>
              <option value="low">낮음</option>
              <option value="medium">보통</option>
              <option value="high">높음</option>
            </select>
          </Field>
        </div>
        <div className="pt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => router.push("/")}>취소</Button>
          <Button variant="go" onClick={submit} disabled={saving}>
            {saving ? <Spinner /> : "프로젝트 생성"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
