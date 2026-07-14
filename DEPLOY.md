# GitHub 업로드 · 배포 가이드

## 1. GitHub에 저장소 만들기

1. https://github.com/new 접속
2. Repository name: `show-running-simulator` (원하는 이름으로)
3. Public 또는 Private 선택 (대회 심사용이면 Private도 무방, 심사위원 초대 가능)
4. **"Add a README file" 체크 해제** (이미 프로젝트에 README가 있음)
5. "Create repository" 클릭

## 2. 로컬에서 GitHub로 푸시하기

터미널(cmd/PowerShell/터미널 앱)에서 `showrunner` 폴더로 이동한 뒤:

```bash
git remote add origin https://github.com/본인계정/show-running-simulator.git
git branch -M main
git push -u origin main
```

(이 프로젝트는 이미 `git init` + 첫 커밋까지 되어 있는 상태로 전달됩니다. `git remote add`부터 시작하면 됩니다.)

로그인 창이 뜨면 GitHub 계정으로 인증하세요 (비밀번호 대신 Personal Access Token이 필요할 수 있습니다 — GitHub가 안내하는 대로 진행하면 됩니다).

## 3. Render.com으로 배포하기 (컴퓨터를 꺼도 계속 켜져 있는 방식)

1. https://render.com 가입 (GitHub 계정으로 가입하면 연동이 빠릅니다)
2. 대시보드에서 **New → Blueprint** 선택
3. 방금 올린 `show-running-simulator` 저장소 선택 → Render가 저장소 안의 `render.yaml`을 자동으로 인식합니다
4. `ANTHROPIC_API_KEY` 항목은 비워두면 Mock 모드로 동작합니다. Claude API를 연결하려면 Render 대시보드의 Environment 탭에서 값을 입력하세요.
5. `APP_SECRET`(로그인 세션 쿠키 서명용)은 `render.yaml`에 `generateValue: true`로 설정되어 있어 Render가 배포 시 안전한 무작위 값을 자동으로 생성합니다 — 별도로 입력할 필요 없습니다.
5. "Apply" 클릭 → 몇 분 후 `https://show-running-simulator.onrender.com` 같은 공개 URL이 발급됩니다.

이후 GitHub의 `main` 브랜치에 새로 푸시할 때마다 Render가 자동으로 재배포합니다.

## 참고 — 무료 플랜 특성

Render 무료 플랜은 일정 시간(약 15분) 요청이 없으면 서버가 절전 상태로 들어갑니다. 이후 첫 접속 시 10~30초 정도 깨어나는 시간이 걸릴 수 있습니다 (컴퓨터를 켜둘 필요는 없습니다 — 클라우드에서 자동으로 재기동됩니다). 대회 발표 직전에는 미리 한 번 접속해 서버를 깨워두는 것을 권장합니다.

## 배포 후 첫 로그인

`npm run seed`가 자동 실행되면서 데모 프로필이 생성됩니다.

- 이름: **데모**
- PIN: **1234**

발표 때는 이 계정으로 로그인하거나, 화면에서 "새 프로필 만들기"로 직접 새 프로필을 만들어 사용하세요. 프로필별로 프로젝트와 레슨런이 서로 분리되어 보입니다.

## 데이터에 관한 주의사항

이 앱은 데이터를 서버의 JSON 파일(`data/db.json`)에 저장합니다. `render.yaml`에 영구 디스크(`disk`) 설정을 포함해뒀기 때문에 재배포해도 데이터가 유지됩니다. 다만 무료 플랜의 디스크 용량은 제한적이니, 대회용 데모 목적이라면 충분하지만 실제 운영에는 Prisma + PostgreSQL 전환을 권장합니다 (README의 "데이터 레이어에 관한 안내" 참고).
