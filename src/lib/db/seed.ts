import { v4 as uuid } from "uuid";
import { db } from "./store";
import {
  Profile, Project, ProjectDocument, EventProgram, Resource, Dependency, Risk, HistoricalCase,
} from "@/types/models";
import { calcRiskScore } from "@/lib/simulation/risk";
import { hashPin } from "@/lib/auth";

// GV60 MAGMA DRIVING EXPERIENCE — 실제 운영매뉴얼(2026.02.06 F) 및 행사 후
// Lesson Learned / 언론사 공통 VOC 보고서를 기반으로 구성된 샘플 프로젝트.
// 실명·소속 언론사 등 개인 식별 정보는 역할명/일반화된 표현으로 대체했다.
const PROJECT_ID = "seed-gv60-magma";
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

/** 데모 프로필이 없으면 만든다. PIN은 README/DEPLOY 문서에 안내된 고정값(9999)이다. */
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
    name: "GV60 MAGMA 미디어 시승회",
    eventType: "brand_event",
    eventDate: "2026-02-10",
    venue: "제네시스 수지 (경기 용인) · KATRI 한국교통안전공단 자동차안전연구원 (경기 화성)",
    clientName: "제네시스 (GENESIS)",
    audienceSize: 42,
    importanceLevel: "critical",
    safetySensitivity: "high",
    keyPrograms: [
      "리셉션 및 참가자 등록", "Welcome Speech & 코스 브리핑", "MAGRIDER 시승",
      "드래그 레이스", "자율 시승", "차량 데미지 점검", "테크 간담회", "시상식 및 환송",
    ],
    keyPeople: ["치프 인스트럭터", "인스트럭터", "진행팀장", "진행요원", "발렛요원", "케이터링 담당", "기술 연구원"],
    keyEquipment: ["GV60 MAGMA 시승 차량", "예비 차량", "GPS 트래커", "드래그레이스 세이프존 라바콘", "운영 차량(V2L)", "PDP 프롬프터"],
    readinessScore: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.createProject(project);

  const programs: EventProgram[] = [
    program({ title: "리셉션 및 참가자 등록", programType: "reception", startTime: "09:00", endTime: "09:10", location: "제네시스 수지 4F 리셉션", sequence: 1, responsiblePersons: ["리셉션 담당", "발렛요원"], requiredResources: ["리셉션 데스크", "케이터링 세트"], preconditions: ["사전 문진표 배포 완료"], backupPlans: ["대기 그룹 케이터링 공간으로 분산 안내"], decisionMaker: "진행팀장", failureImpact: "혼잡 시간대 이동 지연으로 전체 세션 시작 지연" }),
    program({ title: "Welcome Speech & 코스 브리핑", programType: "briefing", startTime: "09:10", endTime: "09:25", location: "제네시스 수지 4F 브리핑룸", sequence: 2, responsiblePersons: ["치프 인스트럭터"], requiredResources: ["PDP 프롬프터"], preconditions: ["브리핑 스크립트 최종본 준비"], backupPlans: ["인스트럭터 애드리브 진행"], decisionMaker: "치프 인스트럭터", failureImpact: "안전 수칙 전달 누락 위험" }),
    program({ title: "MAGRIDER 시승", programType: "test_drive", startTime: "09:25", endTime: "10:25", location: "제네시스 수지 → KATRI (국도+고속도로, 51km)", sequence: 3, responsiblePersons: ["인스트럭터 동승", "GPS 모니터링 요원"], requiredResources: ["GV60 MAGMA 시승 차량", "GPS 트래커"], preconditions: ["배터리 완충 확인", "GPS 신호 사전 점검"], backupPlans: ["우천·안개 시 인스트럭터 직접 운행으로 전환"], decisionMaker: "치프 인스트럭터", failureImpact: "차량 핸들링 등 핵심 USP 체감 저하" }),
    program({ title: "드래그 레이스", programType: "performance_demo", startTime: "10:25", endTime: "11:15", location: "KATRI 300m 직선 구간", sequence: 4, responsiblePersons: ["치프 인스트럭터", "안전 요원"], requiredResources: ["드래그레이스 세이프존 라바콘"], preconditions: ["사전 문진표 8번(건강 상태) 동의 확인"], backupPlans: ["우천 시 제로백 체험(인스트럭터 운전)으로 전환"], decisionMaker: "치프 인스트럭터", failureImpact: "안전사고 위험 또는 핵심 체험 콘텐츠 손실" }),
    program({ title: "자율 시승", programType: "test_drive", startTime: "11:15", endTime: "12:25", location: "KATRI → 제네시스 수지 (국도+고속도로+곡선, 56km)", sequence: 5, responsiblePersons: ["진행요원"], requiredResources: ["GV60 MAGMA 시승 차량", "주행 기록 데이터 로거"], preconditions: [], backupPlans: ["예비 차량 투입"], decisionMaker: "진행팀장", failureImpact: "개인별 주행 기록 비교 피드백 제공 불가" }),
    program({ title: "차량 데미지 점검", programType: "vehicle_check", startTime: "12:25", endTime: "12:35", location: "제네시스 수지 지하 주차장", sequence: 6, responsiblePersons: ["진행요원"], requiredResources: ["차량 점검 체크리스트"], preconditions: [], backupPlans: [], decisionMaker: "진행팀장" }),
    program({ title: "테크 간담회", programType: "tech_qna", startTime: "12:35", endTime: "12:55", location: "제네시스 수지 4F 브리핑룸", sequence: 7, responsiblePersons: ["기술 연구원"], requiredResources: ["사전 FAQ 매뉴얼"], preconditions: ["연구원 참석 확정"], backupPlans: ["연구원 부재 시 사전 FAQ 매뉴얼로 대응"], decisionMaker: "PR 담당", failureImpact: "기술 질의 대응 실패로 신뢰도 저하" }),
    program({ title: "시상식 및 환송", programType: "closing", startTime: "12:55", endTime: "13:00", location: "제네시스 수지 4F", sequence: 8, responsiblePersons: ["진행팀장"], requiredResources: ["케이터링 세트"], preconditions: [], backupPlans: [], decisionMaker: "진행팀장" }),
  ];
  db.replacePrograms(PROJECT_ID, programs);
  const byTitle = (t: string) => programs.find((p) => p.title === t)!;

  const resources: Resource[] = [
    resource({ name: "GV60 MAGMA 시승 차량", resourceType: "vehicle", status: "ready", backupAvailable: true, criticality: "critical", quantity: 8 }),
    resource({ name: "예비 차량", resourceType: "vehicle", status: "pending", backupAvailable: false, criticality: "high", quantity: 2 }),
    resource({ name: "GPS 트래커", resourceType: "equipment", status: "at_risk", backupAvailable: false, criticality: "medium", quantity: 8 }),
    resource({ name: "드래그레이스 세이프존 라바콘", resourceType: "equipment", status: "ready", backupAvailable: true, criticality: "high" }),
    resource({ name: "운영 차량(V2L)", resourceType: "vehicle", status: "ready", backupAvailable: false, criticality: "medium" }),
    resource({ name: "PDP 프롬프터", resourceType: "equipment", status: "ready", backupAvailable: true, criticality: "medium" }),
    resource({ name: "치프 인스트럭터", resourceType: "staff", status: "ready", backupAvailable: false, criticality: "critical" }),
    resource({ name: "인스트럭터", resourceType: "staff", status: "ready", backupAvailable: true, criticality: "high", quantity: 5 }),
    resource({ name: "진행팀장", resourceType: "staff", status: "ready", backupAvailable: false, criticality: "high" }),
    resource({ name: "발렛요원", resourceType: "staff", status: "pending", backupAvailable: false, criticality: "medium" }),
    resource({ name: "기술 연구원", resourceType: "person", status: "pending", backupAvailable: false, criticality: "high" }),
    resource({ name: "온장고 및 난방기(핫팩 포함)", resourceType: "equipment", status: "ready", backupAvailable: true, criticality: "medium" }),
  ];
  db.replaceResources(PROJECT_ID, resources);
  const byName = (n: string) => resources.find((r) => r.name === n)!;

  const dependencies: Dependency[] = [
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("드래그 레이스").id, targetType: "resource", targetId: byName("드래그레이스 세이프존 라바콘").id, dependencyType: "requires", description: "드래그 레이스는 최소 안전거리를 확보한 세이프존 라바콘 설치가 선행되어야 합니다." },
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("MAGRIDER 시승").id, targetType: "resource", targetId: byName("GPS 트래커").id, dependencyType: "requires", description: "MAGRIDER 시승 구간은 실시간 위치 모니터링을 위한 GPS 트래커가 필요합니다." },
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("테크 간담회").id, targetType: "resource", targetId: byName("기술 연구원").id, dependencyType: "requires", description: "테크 간담회는 기술 연구원 참석이 확정되어야 진행 가능합니다." },
    { id: uuid(), projectId: PROJECT_ID, sourceType: "program", sourceId: byTitle("자율 시승").id, targetType: "program", targetId: byTitle("차량 데미지 점검").id, dependencyType: "must_finish_before", description: "자율 시승 복귀 후 차량 데미지 점검이 끝나야 다음 세션 배차가 가능합니다." },
  ];
  db.replaceDependencies(PROJECT_ID, dependencies);

  // 실제 Lesson Learned / VOC 보고서에서 확인된 이슈를 위험 항목으로 반영
  const risks: Risk[] = [
    risk({ title: "GPS 트래커 전원 간섭으로 실시간 위치 추적 끊김", category: "equipment", description: "트렁크에 짐을 보관할 때 유선형 GPS 트래커의 전원이 눌려 신호가 간헐적으로 끊기는 현상이 실제 행사에서 확인되었습니다.", probability: 4, impact: 3, detectabilityMod: 1.0, relatedProgramId: byTitle("MAGRIDER 시승").id, relatedResourceId: byName("GPS 트래커").id, evidenceType: "historical_case", evidenceText: "Lesson Learned: GPS 기반 실시간 운영 관리 체계 — 배터리형 GPS 대안 필요", mitigation: "배터리형 GPS 트래커로 교체하거나 트렁크 짐 적재 위치를 사전 지정하십시오." }),
    risk({ title: "기상 악화 시 참가자 직접 운행 리스크", category: "weather", description: "우천·안개 등 기상 악화 상황에서 참가자가 직접 운행할 경우 안전사고 위험이 커집니다. 실제 행사에서는 1차수에 인스트럭터 직접 운행으로 전환해 무사고를 달성했습니다.", probability: 3, impact: 4, detectabilityMod: 0.8, relatedProgramId: byTitle("MAGRIDER 시승").id, evidenceType: "historical_case", evidenceText: "Lesson Learned: 안전사고 제로 행사 달성 — 기상 악화 시 인스트럭터 직접 운행 전환", mitigation: "기상 악화 기준을 사전에 정의하고, 기준 충족 시 즉시 인스트럭터 직접 운행으로 전환하십시오." }),
    risk({ title: "드래그 레이스 1회 제한에 대한 참가자 아쉬움", category: "content", description: "광활한 KATRI 테스트 공간 대비 체험 콘텐츠가 드래그 레이스 1회로 제한되어, 참가 매체로부터 아쉽다는 피드백이 다수 확인되었습니다.", probability: 3, impact: 2, detectabilityMod: 1.2, relatedProgramId: byTitle("드래그 레이스").id, evidenceType: "historical_case", evidenceText: "VOC: KATRI 공간 활용도 아쉬움 — 안전 우선 정책과 퍼포먼스 체험 기대 사이의 딜레마", mitigation: "드리프트 시연 등 추가 퍼포먼스 데모 보강을 검토하십시오." }),
    risk({ title: "차량 자유 출발로 인한 촬영 동선 정렬성 저하", category: "schedule", description: "차량 순서와 무관한 자유 출발 방식으로 인해 현장 정렬성이 저하되어 촬영·콘텐츠 확보 관점에서 아쉬움이 있었습니다.", probability: 3, impact: 2, detectabilityMod: 1.2, relatedProgramId: byTitle("MAGRIDER 시승").id, evidenceType: "historical_case", evidenceText: "Lesson Learned: 프로그램 및 시승 운영 고도화 방향 — 출발 템포 관리 필요", mitigation: "촬영/콘텐츠 확보 관점에서 출발 순서와 템포를 사전 조율하십시오." }),
    risk({ title: "예비 차량 활용 전략 사전 미확정", category: "vehicle", description: "예비 차량을 언제, 어떤 기준으로 투입할지에 대한 가이드라인이 행사 전 명확히 확정되지 않았습니다.", probability: 2, impact: 3, detectabilityMod: 1.0, relatedResourceId: byName("예비 차량").id, evidenceType: "historical_case", evidenceText: "Lesson Learned: 예비 차량 활용 전략 사전 확정 필요", mitigation: "행사 전 예비차 투입 가이드라인을 명확히 하고 인근 시설과 사전 협의하십시오." }),
    risk({ title: "혹한기 동파로 인한 전력 일시 중단", category: "power", description: "혹한기 행사 중 동파 영향으로 행사장 전력이 일시적으로 차단될 수 있습니다. 실제 행사 3일차 오후에 이 현상이 발생했습니다.", probability: 2, impact: 4, detectabilityMod: 1.0, evidenceType: "historical_case", evidenceText: "Lesson Learned: 전력 일시 중단 이슈 및 대응 — 운영 차량 V2L 기능으로 해결한 사례", mitigation: "혹한기 행사 시 예비 전력 확보 및 비상 대응 매뉴얼을 사전 점검하십시오." }),
    risk({ title: "그룹 단위 교육 방식으로 인한 체험 대기 지연", category: "schedule", description: "1회차 세션에서 그룹 단위 교육 방식으로 인해 체험 시간이 지연되어 참가자 컴플레인이 발생한 이력이 있습니다.", probability: 3, impact: 2, detectabilityMod: 1.0, relatedProgramId: byTitle("Welcome Speech & 코스 브리핑").id, evidenceType: "historical_case", evidenceText: "Lesson Learned: 동선 및 대기 관리 — 도착 순서 기준 개별 원스톱 프로세스 전환 사례", mitigation: "그룹 교육 대신 도착 순서 기준 개별 원스톱(브리핑→교육→체험) 프로세스로 운영하십시오." }),
    risk({ title: "테크 간담회 연구원 부재 시 대응 매뉴얼 부재", category: "presenter", description: "즉각 답변이 어려운 기술 질문 발생 시, 연구원 부재 상황을 가정한 사전 FAQ나 대응 시나리오가 마련되어 있지 않습니다.", probability: 2, impact: 3, detectabilityMod: 1.2, relatedProgramId: byTitle("테크 간담회").id, relatedResourceId: byName("기술 연구원").id, evidenceType: "historical_case", evidenceText: "Lesson Learned: 질의응답 대응 매뉴얼화 필요", mitigation: "사전 FAQ 매뉴얼과 연구원 부재 시 대응 시나리오를 구축하십시오." }),
    risk({ title: "엘리베이터 동선 혼잡으로 인한 이동 지연", category: "venue", description: "전시장과 시승 동선이 연계되어 있어, 혼잡 시간대에 엘리베이터 이용으로 인한 이동 지연 가능성이 있습니다.", probability: 3, impact: 2, detectabilityMod: 1.0, evidenceType: "historical_case", evidenceText: "Lesson Learned: 공간 운영 측면 개선 필요사항 — 엘리베이터 동선 관리 고도화 필요", mitigation: "프로그램 안내 후 시승 차량 이동 시 그룹을 분산하고, 세션별 인원 수에 맞춘 유동적 탑승 관리 체계를 마련하십시오." }),
  ];
  db.replaceRisks(PROJECT_ID, risks);

  // 실제 행사 후 Lesson Learned + 언론사 공통 VOC 요약을 과거 결과보고서 문서로 등록
  const pastReportDoc: ProjectDocument = {
    id: uuid(),
    projectId: PROJECT_ID,
    filename: "GV60-MAGMA-DRIVING-EXPERIENCE-Lesson-Learned.txt",
    fileType: "txt",
    documentCategory: "past_report",
    storagePath: "seed://virtual",
    processingStatus: "completed",
    extractedText:
      "GV60 MAGMA DRIVING EXPERIENCE — Lesson Learned & VOC 요약\n\n" +
      "[긍정 요소]\n" +
      "1. 전시장-시승 연계 운영: 제네시스 수지 전시장 정상 운영 시간 내 미디어 시승을 병행했고, 일반 관람객과 시승 참가자 동선을 분리해 운영 충돌을 최소화했다.\n" +
      "2. 세션별 케이터링을 오전/오후로 분리 운영하고 세션 종료 후 F&B를 보완해 신선도를 유지했다.\n" +
      "3. 안전사고 제로 달성: 2월 11일(1차수)에는 우천·안개 등 기상 악화를 고려해 인스트럭터 직접 운행 방식으로 전환하는 보수적 운영을 했고, 그 결과 안전사고 없이 전 일정을 무사히 마쳤다. 온장고·난방기 외에 핫팩과 패딩을 구비해 추운 장소에서도 환자 발생이 없었다.\n" +
      "4. GPS 트래커로 실시간 위치를 체크해 원활한 운영이 가능했다. 다만 일부 구간에서 GPS 신호가 간헐적으로 끊기는 현상이 있었는데, 분석 결과 트렁크에 짐을 보관할 때 GPS 유선 전원을 건드려서 발생한 것으로 확인되었다. 추후 배터리형 GPS로 대안을 마련할 필요가 있다.\n" +
      "5. 300m 직선 구간을 활용한 드래그 레이스 프로그램으로 제로백(정지 상태에서 100km/h까지 약 3초대) 가속 성능을 직접 체감시켰고, 이후 브랜드 및 차량 신뢰도가 상승했다는 미디어 피드백이 다수 확보되었다.\n" +
      "6. 주행 기록 데이터를 활용해 개인별 기록 비교 및 개선 포인트를 제공, 단순 체험형 이벤트를 넘어 트레이닝 프로그램 성격을 강화했다.\n" +
      "7. 숙련된 인스트럭터의 명확하고 반복적인 브리핑으로 안전 및 차량 이해도를 확보했다.\n\n" +
      "[개선 필요사항]\n" +
      "1. 엘리베이터 동선 관리 고도화가 필요하다. 혼잡 시간대 이동 지연 가능성이 있어 프로그램 안내 후 시승 차량 이동 시 그룹 분산 운영과 세션별 인원수에 따른 유동적 탑승 관리 체계가 필요하다.\n" +
      "2. 브리핑 공간 내 추가 체류 콘텐츠가 부족했다. MAGMA 파츠 외 라이프스타일 전시 콘텐츠 보강을 통한 공간 체류 경험의 콘텐츠화를 검토해야 한다.\n" +
      "3. 즉각 답변이 어려운 기술 질문 발생 시를 대비한 사전 FAQ 매뉴얼 및 연구원 부재 상황 대비 시나리오가 필요하다.\n" +
      "4. 차량 순서와 무관한 자유 출발로 일부 현장 정렬성이 저하되었다. 촬영·콘텐츠 확보 관점에서 출발 템포 관리가 필요하다.\n" +
      "5. 예비 차량 활용 전략을 행사 전에 명확히 확정하고, 인근 시설 카리프트 활용 가능성도 사전 협의가 필요하다.\n" +
      "6. 시승 코스가 고속도로 위주로 구성되어 코너 체험 밀도가 부족하다는 참가 매체 피드백이 있었다. 참가자들은 차량의 가장 매력적인 지점이 핸들링이라고 평가하면서도, 코스에 코너가 더 많았으면 좋겠다는 아쉬움을 표했다. 차기 행사 시 와인딩 구간 확대 및 핸들링 체감 섹션 명확화가 필요하다.\n" +
      "7. KATRI 행사장 특성상 T보드가 설치되지 않은 구역에서 참가자 동선 혼란이 발생할 우려가 있다. 현장 유도 인력 추가 배치와 안내 T보드 추가 설치가 필요하다.\n" +
      "8. 광활한 테스트 공간 대비 체험 콘텐츠가 드래그 레이스 1회로 제한되어 아쉽다는 반응이 있었다. 안전을 우선한 행사 설계와 퍼포먼스 체험 기대 사이에서 발생하는 이율배반적 상황으로, 드리프트 시연 등 추가 퍼포먼스 데모 보강 가능성을 검토해야 한다.\n" +
      "9. 3일차 오후에 동파 영향으로 행사장 전력이 일시적으로 차단되는 상황이 발생했다. 운영 차량의 V2L 기능을 활용해 임시 전력을 공급함으로써 프로그램 중단 없이 안정적으로 해결했다. 향후 혹한기 행사 시 예비 전력 확보 및 비상 대응 매뉴얼을 사전 점검해 리스크 관리 체계를 강화할 필요가 있다.\n" +
      "10. 1회차 세션에서 체험 시간 지연으로 컴플레인이 발생했다. 소규모 미디어 행사 특성상 대기 없이 순차 체험을 유도하는 것이 중요하며, 기존 그룹 단위 교육 방식 대신 도착 순서 기준으로 신속하게 개별 원스톱 프로세스(브리핑→교육→체험)로 전환하고, 세션 시작 전 리마인드 연락 체계를 보다 강화해 일정 지연 리스크를 사전 관리해야 한다.\n" +
      "11. 화장실 이동 동선이 길다는 의견이 다수 있었고, 운영 기간 중 동파 이슈로 인한 화장실 폐쇄로 참가자 불편이 발생했다. 운영 차량 2대를 투입해 화장실 이동 셔틀을 즉시 운영함으로써 참가자 불편을 최소화했으며, 향후 야외 거점 설정 시 이동식 화장실 등 기본 편의 인프라 보강이 필요하다.\n\n" +
      "[언론사 공통 VOC 요약]\n" +
      "1. '일상+서킷'의 균형이 좋다는 평가가 여러 매체에서 반복적으로 확인되었다 — 서킷 전용이 아니라 일상에서도 자연스럽고 편하다는 평가.\n" +
      "2. 체감 성능을 숫자로 표현한 기사가 많았다 (정지 상태에서 100km/h까지 약 10.9초, 최고 속도 약 264km/h, 부스트 모드 15초 등). 거의 모든 기사에서 성능 스펙을 핵심 문장에 배치했다.\n" +
      "3. '정숙한데 재밌다'는 평가가 다수 있었다. 정숙성 보강(차음, 액티브 노이즈 컨트롤 등)과 굉음·진동·가상 사운드 기술을 통한 감성 연출이 동시에 언급되었다.\n" +
      "4. 제동 및 하체 세팅에 대한 신뢰가 높았다. 드래그 레이스 이후 급제동, 고속 영역에서의 안정감이 인상 포인트로 자주 등장했다.\n" +
      "5. 마그마 오렌지 컬러와 디테일(스티치, 샤무드, 에어로 요소)이 시각적 존재감을 만들어 럭셔리 고성능 서사에 기여했다는 평가가 있었다.\n" +
      "6. 가격 프레임에 대한 언급이 명확했다. 일부 매체는 경쟁 차종 대비 포지셔닝을 함께 언급했다.\n\n" +
      "전반적으로 안전사고 없이 성공적으로 마무리되었다.",
    errorMessage: null,
    createdAt: now,
  };
  db.createDocument(pastReportDoc);

  const historicalCases: HistoricalCase[] = [
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "MAGRIDER 시승 구간에서 GPS 트래커 신호가 간헐적으로 끊김",
      rootCause: "트렁크에 짐을 보관할 때 유선형 GPS 트래커의 전원이 눌리면서 신호가 끊김",
      response: "당일에는 무전으로 개별 차량 위치를 재확인하며 대응",
      outcome: "실시간 모니터링 공백은 있었으나 큰 지연 없이 운영",
      severity: 3, preventable: true,
      prevention: "배터리형 GPS 트래커로 교체하거나 트렁크 짐 적재 위치를 사전 지정",
      relatedResources: ["GPS 트래커", "GV60 MAGMA 시승 차량"],
      tags: ["equipment", "vehicle"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "2월 11일(1차수) 우천·안개 등 기상 악화로 참가자 직접 운행 시 안전사고 위험 증가",
      rootCause: "겨울철 강수·안개로 노면 상태 및 시야 확보가 불안정",
      response: "해당 세션을 인스트럭터 직접 운행 방식으로 즉시 전환해 보수적으로 운영",
      outcome: "안전사고 없이 전 일정 무사히 완료",
      severity: 4, preventable: true,
      prevention: "기상 악화 기준을 사전에 정의하고 기준 충족 시 즉시 직접 운행으로 전환하는 절차 수립",
      relatedResources: ["GV60 MAGMA 시승 차량"],
      tags: ["weather", "safety"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "3일차 오후 동파 영향으로 행사장 전력이 일시적으로 차단됨",
      rootCause: "혹한기 배관 동파로 인한 행사장 전력 계통 이상",
      response: "운영 차량의 V2L(Vehicle to Load) 기능을 활용해 임시 전력을 공급",
      outcome: "프로그램 중단 없이 전력 이슈를 안정적으로 해결",
      severity: 3, preventable: false,
      prevention: "혹한기 행사 시 예비 전력 확보 및 비상 대응 매뉴얼을 사전 점검",
      relatedResources: ["운영 차량(V2L)"],
      tags: ["power", "weather"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "1회차 세션에서 체험 시간 지연으로 참가자 컴플레인 발생",
      rootCause: "그룹 단위 교육 방식으로 진행해 개별 대기 시간이 길어짐",
      response: "도착 순서 기준으로 개별 원스톱 프로세스(브리핑→교육→체험)로 즉시 전환",
      outcome: "이후 세션부터는 대기 관련 컴플레인 없이 순조롭게 진행",
      severity: 2, preventable: true,
      prevention: "세션 시작 전 리마인드 연락 체계를 강화해 일정 지연 리스크를 사전 관리",
      relatedResources: [],
      tags: ["schedule", "staffing"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "운영 기간 중 동파 이슈로 화장실이 폐쇄되어 참가자 불편 발생, 화장실 이동 동선도 길다는 의견 다수",
      rootCause: "혹한기 배관 동파로 인한 화장실 시설 폐쇄, 동선 설계상 거리 이슈",
      response: "운영 차량 2대를 투입해 화장실 이동 셔틀을 즉시 운영",
      outcome: "참가자 불편을 최소화하며 현장 만족도를 안정적으로 관리",
      severity: 2, preventable: false,
      prevention: "향후 야외 거점 설정 시 이동식 화장실 등 기본 편의 인프라 사전 보강",
      relatedResources: [],
      tags: ["venue"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "광활한 KATRI 테스트 공간 대비 체험 콘텐츠가 드래그 레이스 1회로 제한되어 참가 매체로부터 아쉽다는 피드백 다수",
      rootCause: "안전을 우선한 행사 설계로 인해 퍼포먼스 체험 기회가 제한됨",
      response: "당일 대응은 없었으며 사후 피드백으로 수렴",
      outcome: "행사 자체는 무사고로 마무리되었으나 콘텐츠 만족도 측면에서 개선 여지가 확인됨",
      severity: 2, preventable: true,
      prevention: "드리프트 시연 등 추가 퍼포먼스 데모 보강 가능성을 차기 행사에서 검토",
      relatedResources: [],
      tags: ["content"],
    },
    {
      id: uuid(), profileId: DEMO_PROFILE_ID, sourceDocumentId: pastReportDoc.id, eventType: "brand_event",
      situation: "시승 코스가 고속도로 위주로 구성되어 코너 체험 밀도가 부족하다는 참가 매체 피드백",
      rootCause: "코스 설계 단계에서 고속 주행 구간 비중이 높게 책정됨",
      response: "당일 코스 변경 없이 예정대로 진행",
      outcome: "성능 체감에는 긍정적이었으나 핸들링 체감 기회가 제한적이었다는 평가",
      severity: 1, preventable: true,
      prevention: "차기 행사 시 와인딩 구간 확대 및 핸들링 체감 섹션을 명확히 구성",
      relatedResources: [],
      tags: ["content"],
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
