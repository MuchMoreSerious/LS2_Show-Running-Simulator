@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   SHOWRUNNER 시작 준비 중...
echo ============================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 먼저 설치한 뒤 이 파일을 다시 더블클릭해 주세요.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 처음 실행이라 필요한 패키지를 설치합니다 ^(1~2분 정도 걸려요^)...
  call npm install
  if %errorlevel% neq 0 (
    echo 설치 중 오류가 발생했습니다.
    pause
    exit /b 1
  )
)

if not exist "data\db.json" (
  echo 샘플 프로젝트^(CES 2027^)를 생성합니다...
  call npm run seed
)

echo.
echo 서버를 시작합니다. 잠시 후 브라우저가 자동으로 열립니다.
echo ^(이 창을 닫으면 서버가 종료됩니다^)
echo.

start "" cmd /c "timeout /t 6 >nul && start http://localhost:3000"
call npm run dev

pause
