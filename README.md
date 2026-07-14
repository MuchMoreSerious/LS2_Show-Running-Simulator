# Show-Running Simulator

**AI 행사 데스크 리허설 시뮬레이터** — 행사는 한 번뿐이지만, 시뮬레이션 안에서는 여러 번 실패할 수 있다.

SHOWRUNNER는 행사 운영 매뉴얼, 타임테이블, 준비 현황, 과거 결과보고서를 기반으로 본 행사 전에 데스크 리허설을 수행하는 시뮬레이션 도구입니다. 문서에서 행사 구조와 위험 요소를 추출하고, 행사 진행 시간축을 따라 돌발상황을 발생시키며, 사용자의 판단이 일정·안전·연출·고객·비용에 미치는 영향을 추적합니다.

## 주요 기능

- **프로필 기반 접근 잠금** — 이름 + 4자리 PIN으로 로그인. 프로필별로 프로젝트·문서·레슨런이 서로 분리되어 다른 프로필에는 노출되지 않는다
- **레슨런(과거 사례) 프로필 단위 공유** — 한 프로젝트에서 업로드한 과거 결과보고서/사고 기록이 같은 프로필의 다른(새) 프로젝트 시뮬레이션에도 "과거 사례 기반 상황"으로 자동 재사용된다. 다른 프로필의 사례와는 절대 섞이지 않는다
- **행사 프로젝트 관리** — 행사 유형, 중요도, 안전 민감도를 포함한 프로젝트 생성
- **문서 업로드 및 AI 구조화** — PDF/DOCX/XLSX/CSV/TXT/MD 문서에서 프로그램·자원·위험 추출, 사용자 검토 후 반영
- **신뢰도 표시** — 모든 추출 항목에 "문서 명시 / 문서 간 추론 / AI 추정" 신뢰도 표시
- **사전 위험 진단** — 시간 충돌, 인력 중복, 준비 미완료, 대체안 미비 등 12개 범주의 결정론적 진단 (위험 점수 = 발생 가능성 × 영향도 × 발견 난이도 보정)
- **시뮬레이션 엔진** — 4종 상황(데이터 기반 필연 / 확률적 / 과거 사례 기반 / 연쇄)을 시간순으로 발생, 선택에 따른 점수 변화와 후속 상황 생성
- **결과 리포트** — 종합 준비도, 취약 구간, 위험 자원, 매뉴얼 반영 제안. Markdown 내보내기 지원
- **Mock AI Provider** — API 키 없이 완전 오프라인 동작, Claude API 키 설정 시 자동 전환

## 기술 스택

| 레이어 | 기술 |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript strict, React 19, Tailwind CSS 4 |
| Backend | Next.js Route Handlers |
| 데이터 | JSON 파일 저장소 (Prisma schema 동봉 — 아래 참고) |
| AI | Anthropic Claude API (선택) / Mock Provider (기본) |
| 문서 처리 | pdf-parse, mammoth(DOCX), SheetJS(XLSX) |
| 검색(RAG) | 로컬 term-overlap 벡터 저장소 (임베딩 백엔드 교체 가능) |
| 테스트 | Vitest |

### 데이터 레이어에 관한 안내

`prisma/schema.prisma`에 정식 데이터 모델이 정의되어 있습니다. 이 프로젝트가 개발된 샌드박스 환경에서는 Prisma 쿼리 엔진 바이너리 다운로드(binaries.prisma.sh)가 네트워크 정책상 차단되어, **동일한 스키마 형태를 1:1로 미러링하는 JSON 파일 저장소**(`src/lib/db/store.ts`, 데이터는 `data/db.json`)로 구동합니다. 일반 환경에서 Prisma로 전환하려면:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

이후 `src/lib/db/store.ts`의 각 함수를 `@prisma/client` 호출로 교체하면 됩니다. 함수 시그니처와 타입(`src/types/models.ts`)이 스키마와 일치하므로 호출부 수정은 필요 없습니다.

## 설치

```bash
npm install
```

## 환경변수 설정

```bash
cp .env.example .env
```

| 변수 | 설명 | 기본값 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 비워두면 Mock Provider로 동작 | (없음) |
| `ANTHROPIC_MODEL` | Claude 모델명 | `claude-sonnet-4-6` |
| `AI_PROVIDER` | `auto` \| `mock` \| `claude` | `auto` |
| `EMBEDDING_PROVIDER` | `local`(오프라인) | `local` |
| `FILE_STORAGE_ROOT` | 업로드 파일 저장 경로 | `./data/uploads` |
| `DATABASE_URL` | Prisma 전환 시에만 사용 | `file:./dev.db` |

## DB 초기화 및 seed 실행

```bash
npm run seed
```

`data/db.json`을 초기화하고 샘플 프로젝트(**GV60 MAGMA 미디어 시승회**)를 생성합니다. seed를 건너뛰어도 서버 최초 요청 시 샘플 프로젝트가 자동 생성됩니다.

## 개발 서버 실행

```bash
npm run dev        # 개발 모드 (http://localhost:3000)
# 또는
npm run build && npm start   # 프로덕션 모드
```

## 테스트

```bash
npm test
```

위험 점수 공식, 가중치 파생, 점수 적용, 시뮬레이션 엔진(상황 생성·의사결정·연쇄·리포트)에 대한 단위/통합 테스트가 실행됩니다.

## 샘플 데모 실행 방법

1. `npm run seed && npm run dev`
2. 접속하면 로그인 화면이 뜹니다 — 시드된 **데모** 프로필 선택 후 PIN `9999` 입력 (또는 "새 프로필 만들기"로 직접 생성)
3. 홈에서 **GV60 MAGMA 미디어 시승회** 프로젝트 클릭
4. **타임테이블 · 구조** 탭 — 8개 프로그램과 12개 자원 확인, 각 항목 수정 가능
5. **사전 위험 진단** 탭 — "위험 진단 실행"으로 결정론적 진단 실행 (시드된 9개 위험 + 자동 진단 결과 병합, 실제 행사 Lesson Learned 기반)
6. **시뮬레이션** 탭 — 난도·구간·빈도·리스크 범주를 고르고 **GO**
7. 상황 카드에서 선택지를 고르거나 직접 대응안 입력 → 점수 변화와 근거 확인 → 일부 선택은 연쇄 상황 유발
8. 모든 상황 처리 후(또는 "시뮬레이션 종료" 버튼) 결과 리포트 확인, Markdown 내보내기

## 문서 처리 구조

```
업로드 → 저장(FileStorage 추상화) → 텍스트 추출(extract.ts)
      → AI 구조화(AIProvider 추상화) → "검토 필요" 상태로 대기
      → 사용자 검토·수정·승인 → 정식 프로그램 데이터로 반영
```

- 과거 결과보고서/사고 기록은 구조화 대신 **사례 추출**(situation/rootCause/response/outcome) 경로를 탑니다. "전반적으로 잘 진행되었다" 류의 단순 회고 문장은 사례로 저장하지 않습니다.
- 문서 간 정보가 충돌하면 자동 병합하지 않고 검토 화면에 충돌 목록을 표시해 사용자가 기준 정보를 선택하게 합니다.
- RAG: 문서는 600자 청크(100자 오버랩)로 분할되어 로컬 벡터 저장소에 인덱싱됩니다. `getRelevantChunks()`의 시그니처를 유지하면 pgvector/Chroma 등으로 교체 가능합니다.

## 시뮬레이션 엔진 구조

```
startSimulation()
 ├─ 프로그램 타임테이블에서 구간(설치→기술리허설→전체리허설→직전→본행사→철수) 시간창 계산
 ├─ 11.1 데이터 기반 필연 상황: 위험 진단 결과(매뉴얼/준비현황 근거) 상위 항목을 상황화
 ├─ 11.3 과거 사례 기반 상황: HistoricalCase를 현재 행사 구조에 맞게 변환
 └─ 11.2 확률적 상황: 16종 템플릿에서 빈도 설정에 따라 샘플링
getNextScenario() — 시간순으로 상황 활성화
submitDecision()
 ├─ 선택지 효과를 점수에 적용 (난도 배율, 0~100 클램프)
 ├─ 가중 종합점수 재계산 (안전 민감도 high → 안전 가중 40%)
 └─ 11.4 연쇄 상황: newRiskTriggers가 있는 선택은 후속 상황을 큐에 추가 (연쇄 깊이 1 제한)
completeSimulation() — 취약 구간/위험 자원/반복 문제 집계, 리포트 생성
```

점수는 각 항목 100점 시작(피로도는 0 시작), 종합 가중치 기본값은 안전 30% / 일정 20% / 연출 20% / 고객 15% / 비용 10% / 피로도 5%입니다.

## Claude API 연결 방법

1. `.env`에 `ANTHROPIC_API_KEY` 설정
2. 서버 재시작 — `AI_PROVIDER=auto`(기본)면 키 존재 시 자동으로 Claude Provider로 전환
3. 문서 구조화와 사례 추출이 실제 LLM 기반으로 동작 (프롬프트: `src/lib/ai/prompts.ts`, 출력 스키마: `schemas/*.json`)

Mock Provider는 정규식 휴리스틱으로 시간 패턴(HH:mm)이 있는 행을 프로그램으로 추출하며, 신뢰도를 항상 낮게(≤0.6) 표시합니다.

## 알려진 한계

`docs/known-limitations.md` 참고. 요약:

- 샌드박스 제약으로 Prisma 대신 JSON 파일 저장소 사용 (동시성 보장 없음, 단일 노드 전용)
- Mock Provider는 담당자/장비/의존성 추출 불가 — Claude API 연결 시에만 정확도 확보
- 시뮬레이션 중 실시간 시계는 상황 트리거 시각 기반 (연속 시간 진행 아님)
- PDF 리포트 출력은 미구현 (Markdown 내보내기로 대체)
- 직접 입력 대응안은 Mock 모드에서 고정 효과로 평가 (LLM 평가 미연결)
- 인증은 이름+4자리 PIN 수준의 가벼운 "진입 잠금"이며, 이메일 인증·비밀번호 재설정·역할(admin/member) 구분 등 정식 계정 시스템은 없음. 같은 프로필을 여러 사람이 공유하는 팀 단위 사용을 전제로 설계됨

## 향후 개선 방향

`docs/roadmap.md` 참고.
