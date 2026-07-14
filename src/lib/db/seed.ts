import { v4 as uuid } from "uuid";
import { db } from "./store";
import {
  Profile, Project, ProjectDocument, EventProgram, Resource, Dependency, Risk, HistoricalCase,
} from "@/types/models";
import { calcRiskScore } from "@/lib/simulation/risk";
import { hashPin } from "@/lib/auth";

const PROJECT_ID = "seed-ces-2027";
const DEMO_PROFILE_ID = "seed-profile-demo";
const DEMO_PROFILE_NAME = "데모";
const DEMO_PROFILE_PIN = "9999";
const now = new Date().toISOString();

function program(p: Omit<EventProgram, "id" | "projectId" | "confidence" | "status">): EventProgram {
  return {
    id: uuid(),
    projectId: PROJECT_ID,
    confidence: "document_stated",
    status: "planned",
    ...p,
  };
}

function resource(r: Omit<Resource, "id" | "projectId" | "quantity"> & { quantity?: number }): Resource {
  return { id: uuid(), projectId: PROJECT_ID, quantity: r.quantity ?? 1, ...r };
}

function risk(r: Omit<Risk, "id" | "projectId" | "riskScore" | "status">): Risk {
  return {
    id: uuid(),
    projectId: PROJECT_ID,
    status: "open",
    riskScore: calcRiskScore(r.probability, r.impact, r.detectabilityMod),
    ...r,
  };
}

/** 데모 프로필이 없으면 만든다. PIN은 README/DEPLOY 문서에 안내된 고정값(1234)이다. */
async function ensureDemoProfile(): Promise<void> {
  if (db.getProfile(DEMO_PROFILE_ID)) return;
  const profile: Profile = {
    id: DEMO_PROFILE_ID,
    name: DEMO_PROFILE_NAME,
    pinHash: await hashPin(DEMO_PROFILE_PIN),
    createdAt: now,
  };
  db.createProfile(profile);
}

export async function seedDemoProject(): Promise<void> {
  await ensureDemoProfile();
  // 이미 시드되어 있으면 건너뛴다 (idempotent).
  if (db.getProject(PROJECT_ID)) return;

  const project: Project = {
    id: PROJECT_ID,
    profileId: DEMO_PROFILE_ID,
    name: "CES 2027 Press Conference",
    eventType: "corporate_press_conference",
    eventDate: "2027-01-06",
    venue: "Mandalay Bay Convention Center, Las Vegas",
    clientName: "Innocean 클라이언트사 (기업 A)",
    audienceSize: 800,
    importanceLevel: "critical",
    safetySensitivity: "high",
    keyPrograms: [
      "관객 입장", "오프닝 영상", "CEO 발표", "PBV 차량 등장",
      "Boston Dynamics Atlas 등장", "Atlas 배터리 교체 퍼포먼스", "브랜드 비전 발표", "포토세션", "행사 종료",
    ],
    keyPeople: ["CEO 발표자", "MC", "로봇 엔지니어", "차량 드라이버", "무대 감독", "기술 감독", "클라이언트 의사결정권자"],
    keyEquipment: ["Atlas 로봇", "Atlas 예비 배터리", "PBV 차량", "메인 LED", "무선 마이크"],
    readinessScore: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.createProject(project);

  const programs: EventProgram[] = [
    program({ title: "관객 입장", programType: "audience_entry", startTime: "09:00", endTime: "09:30", location: "메인 홀 로비", sequence: 1, responsiblePersons: ["현장 운영 스태프"], requiredResources: ["등록 데스크"], preconditions: [], backupPlans: ["보조 입구 개방"], decisionMaker: "무대 감독" }),
    program({ title: "오프닝 영상", programType: "video_playback", startTime: "09:30", endTime: "09:35", location: "메인 스테이지", sequence: 2, responsiblePersons: ["기술 감독"], requiredResources: ["메인 LED", "오프닝 영상"], preconditions: ["영상 최종본 승인"], backupPlans: [], decisionMaker: "기술 감독", failureImpact: "행사 오프닝 임팩트 저하" }),
    program({ title: "CEO 발표", programType: "keynote", startTime: "09:35", endTime: "09:55", location: "메인 스테이지", sequence: 3, responsiblePersons: ["CEO 발표자", "MC"], requiredResources: ["무선 마이크"], preconditions: ["CEO 리허설 완료"], backupPlans: ["큐카드 백업"], decisionMaker: "클라이언트 의사결정권자", failureImpact: "핵심 메시지 전달 실패" }),
    program({ title: "PBV 차량 등장", programType: "vehicle_reveal", startTime: "09:55", endTime: "10:05", location: "메인 스테이지 진입로", sequence: 4, responsiblePersons: ["차량 드라이버", "안전 요원"], requiredResources: ["PBV 차량"], preconditions: ["동선 통제선 설치"], backupPlans: [], decisionMaker: "무대 감독", failureImpact: "연출 하이라이트 손실" }),
    program({ title: "Boston Dynamics Atlas 등장", programType: "performer_reveal", startTime: "10:05", endTime: "10:15", location: "메인 스테이지", sequence: 5, responsiblePersons: ["로봇 엔지니어"], requiredResources: ["Atlas 로봇"], preconditions: ["배터리 완충"], backupPlans: [], decisionMaker: "로봇 엔지니어", failureImpact: "기술 시연 실패로 미디어 임팩트 저하" }),
    program({ title: "Atlas 배터리 교체 퍼포먼스", programType: "performer_reveal", startTime: "10:15", endTime: "10:25", location: "메인 스테이지", sequence: 6, responsiblePersons: ["로봇 엔지니어"], requiredResources: ["Atlas 로봇", "Atlas 예비 배터리"], preconditions: ["예비 배터리 완충 상태 확인"], backupPlans: [], decisionMaker: "로봇 엔지니어", failureImpact: "핵심 연출 시퀀스 붕괴" }),
    program({ title: "브랜드 비전 발표", programType: "keynote", startTime: "10:25", endTime: "10:45", location: "메인 스테이지", sequence: 7, responsiblePersons: ["CEO 발표자"], requiredResources: ["무선 마이크", "메인 LED"], preconditions: [], backupPlans: [], decisionMaker: "클라이언트 의사결정권자" }),
    program({ title: "포토세션", programType: "photo_session", startTime: "10:45", endTime: "11:00", location: "메인 스테이지 앞", sequence: 8, responsiblePersons: ["현장 운영 스태프"], requiredResources: ["PBV 차량", "Atlas 로봇"], preconditions: [], backupPlans: [], decisionMaker: "무대 감독" }),
    program({ title: "행사 종료", programType: "closing", startTime: "11:00", endTime: "11:10", location: "메인 스테이지", sequence: 9, responsiblePersons: ["MC"], requiredResources: [], preconditions: [], backupPlans: [], decisionMaker: "무대 감독" }),
  ];
  db.replacePrograms(PROJECT_ID, programs);
  const byTitle = (t: string) => programs.find((p) => p.title === t)!;

  const resources: Resource[] = [
    resource({ name: "CEO 발표자", resourceType: "presenter", status: "ready", backupAvailable: false, criticality: "critical" }),
    resource({ name: "MC", resourceType: "presenter", status: "ready", backupAvailable: true, criticality: "high" }),
    resource({ name: "Atlas 로봇", resourceType: "robot", status: "at_risk", backupAvailable: false, criticality: "critical" }),
    resource({ name: "Atlas 예비 배터리", resourceType: "equipment", status: "pending", backupAvailable: false, criticality: "critical" }),
    resource({ name: "PBV 차량", resourceType: "vehicle", status: "ready", backupAvailable: false, criticality: "high" }),
    resource({ name: "메인 LED", resourceType: "equipment", status: "ready", backupAvailable: true, criticality: "high" }),
    resource({ name: "오프닝 영상", resourceType: "content", status: "pending", backupAvailable: false, criticality: "high" }),
    resource({ name: "무선 마이크", resourceType: "equipment", status: "at_risk", backupAvailable: true, criticality: "medium" }),
    resource({ name: "차량 드라이버", resourceType: "staff", status: "ready", backupAvailable: false, criticality: "high" }),
    resource({ name: "로봇 엔지니어", resourceType: "staff", status: "ready", backupAvailable: false, criticality: "critical" }),
    resource({ name: "무대 감독", resourceType: "staff", status: "ready", backupAvailable: false, criticality: "high" }),
    resource({ name: "기술 감독", resourceType: "staff", status: "ready", backupAvailable: true, criticality: "high" }),
    resource({ name: "클라이언트 의사결정권자", resourceType: "person", status: "ready", backupAvailable: false, criticality: "high" }),
  ];
  db.replaceResources(PROJECT_ID, resources);
  const byName = (n: string) => resources.find((r) => r.name === n)!;

  const dependencies: Dependency[] = [
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("Boston Dynamics Atlas 등장").id, targetType: "resource", targetId: byName("Atlas 예비 배터리").id, dependencyType: "requires", description: "Atlas 배터리 교체 퍼포먼스는 완충된 예비 배터리가 필요합니다." },
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("오프닝 영상").id, targetType: "program", targetId: byTitle("CEO 발표").id, dependencyType: "must_finish_before", description: "오프닝 영상 송출이 끝나야 CEO 발표 큐가 시작됩니다." },
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("PBV 차량 등장").id, targetType: "resource", targetId: byName("차량 드라이버").id, dependencyType: "requires", description: "차량 등장은 드라이버 배치가 선행되어야 합니다." },
  ];
  db.replaceDependencies(PROJECT_ID, dependencies);

  const risks: Risk[] = [
    risk({ title: "Atlas 배터리 충전 완료 시간이 리허설 시작 이후", category: "robot", description: "Atlas 예비 배터리 완충 예상 시간이 전체 리허설 시작 시간 이후로 확인됩니다.", probability: 4, impact: 5, detectabilityMod: 1.0, relatedProgramId: byTitle("Atlas 배터리 교체 퍼포먼스").id, relatedResourceId: byName("Atlas 예비 배터리").id, evidenceType: "readiness", evidenceText: "준비 현황표: 배터리 완충 ETA vs 리허설 시작 시각 비교", mitigation: "배터리 충전 시작 시각을 앞당기거나 리허설 순서를 조정하십시오." }),
    risk({ title: "차량 동선과 발표자 이동 동선 일부 중첩", category: "vehicle", description: "PBV 차량 진입 동선이 CEO 발표자의 무대 이동 동선과 일부 겹치는 것으로 확인됩니다.", probability: 3, impact: 4, detectabilityMod: 1.0, relatedProgramId: byTitle("PBV 차량 등장").id, relatedResourceId: byName("PBV 차량").id, evidenceType: "manual", evidenceText: "장소 도면 근거", mitigation: "동선을 분리하거나 시간차를 두십시오." }),
    risk({ title: "오프닝 영상 최종본 승인 미완료", category: "content", description: "오프닝 영상이 클라이언트 최종 승인을 받지 못한 상태입니다.", probability: 3, impact: 4, detectabilityMod: 1.0, relatedProgramId: byTitle("오프닝 영상").id, relatedResourceId: byName("오프닝 영상").id, evidenceType: "readiness", evidenceText: "준비 현황표: 콘텐츠 승인 상태 미완료", mitigation: "행사 전 최종 승인 데드라인을 명확히 하십시오." }),
    risk({ title: "CEO 리허설 참석 가능 시간이 15분뿐", category: "presenter", description: "CEO 발표자의 리허설 참석 가능 시간이 15분으로 제한되어 있습니다.", probability: 4, impact: 3, detectabilityMod: 0.8, relatedProgramId: byTitle("CEO 발표").id, relatedResourceId: byName("CEO 발표자").id, evidenceType: "manual", evidenceText: "인력 배치표 근거", mitigation: "핵심 큐만 압축 리허설로 진행하십시오." }),
    risk({ title: "예비 무선 마이크 배터리 수량 미확인", category: "equipment", description: "예비 무선 마이크 배터리의 정확한 보유 수량이 문서에 명시되어 있지 않습니다.", probability: 3, impact: 2, detectabilityMod: 1.2, relatedResourceId: byName("무선 마이크").id, evidenceType: "readiness", mitigation: "행사 전 배터리 재고를 실사하십시오." }),
    risk({ title: "포토세션 위치 변경안 미반영", category: "venue", description: "장소 도면상 포토세션 위치가 최근 변경되었으나 현장 사이니지 계획에는 반영되지 않았습니다.", probability: 2, impact: 2, detectabilityMod: 1.0, relatedProgramId: byTitle("포토세션").id, evidenceType: "manual", mitigation: "사이니지 및 스태프 브리핑을 업데이트하십시오." }),
  ];
  db.replaceRisks(PROJECT_ID, risks);

  // 샘플 과거 결과보고서 문서 + 사례 (RAG/사례 기반 상황 생성용)
  const pastReportDoc: ProjectDocument = {
    id: uuid(),
    projectId: PROJECT_ID,
    filename: "2025-CES-Press-결과보고서.txt",
    fileType: "txt",
    documentCategory: "past_report",
    storagePath: "seed://virtual",
    processingStatus: "completed",
    extractedText:
      "2025년 CES 프레스컨퍼런스 결과보고서\n\n" +
      "1. 로봇 퍼포먼스 구간에서 배터리 잔량 표시 오류로 인해 예정보다 5분 늦게 배터리 교체가 시작되었다. " +
      "원인은 배터리 관리 소프트웨어의 잔량 표시 지연이었다. 현장에서는 예비 배터리로 즉시 교체해 큰 지연 없이 마무리했다. " +
      "재발 방지를 위해 리허설 단계에서 배터리 관리 소프트웨어 표시값과 실측값을 교차 확인하는 절차를 도입해야 한다.\n\n" +
      "2. 차량 등장 큐에서 드라이버와 무대 감독 간 무전 채널이 달라 신호가 1회 누락되었다. " +
      "차량이 예정보다 20초 늦게 진입했으나 카메라 워크로 자연스럽게 커버되었다. " +
      "재발 방지책으로 모든 등장 큐 관련 인력은 동일 무전 채널을 사용하도록 사전 지정해야 한다.\n\n" +
      "3. 전반적으로 잘 진행되었다.\n\n" +
      "4. 클라이언트 반응이 좋았다.",
    errorMessage: null,
    createdAt: now,
  };
  db.createDocument(pastReportDoc);

  const historicalCases: HistoricalCase[] = [
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "corporate_press_conference",
      situation: "로봇 퍼포먼스 구간에서 배터리 잔량 표시 오류로 배터리 교체가 지연됨",
      rootCause: "배터리 관리 소프트웨어의 잔량 표시 지연",
      response: "예비 배터리로 즉시 교체",
      outcome: "큰 지연 없이 마무리",
      severity: 3, preventable: true,
      prevention: "리허설 단계에서 배터리 관리 소프트웨어 표시값과 실측값 교차 확인",
      relatedResources: ["Atlas 로봇", "Atlas 예비 배터리"],
      tags: ["robot"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "corporate_press_conference",
      situation: "차량 등장 큐에서 무전 채널 불일치로 신호가 누락되어 차량이 20초 늦게 진입",
      rootCause: "드라이버와 무대 감독의 무전 채널 상이",
      response: "카메라 워크로 지연을 자연스럽게 커버",
      outcome: "체감 지연 없이 진행",
      severity: 2, preventable: true,
      prevention: "등장 큐 관련 인력 전원 동일 무전 채널 사전 지정",
      relatedResources: ["PBV 차량"],
      tags: ["vehicle"],
    },
  ];
  db.addHistoricalCases(historicalCases);

  db.updateProject(PROJECT_ID, { readinessScore: computeReadinessScore(risks) });
}

function computeReadinessScore(risks: Risk[]): number {
  if (risks.length === 0) return 100;
  const avgRisk = risks.reduce((sum, r) => sum + r.riskScore, 0) / risks.length;
  return Math.max(0, Math.round(100 - avgRisk * 3));
}
