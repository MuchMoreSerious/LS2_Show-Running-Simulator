#!/bin/bash
# SHOWRUNNER 실행 스크립트 (Mac) — 더블클릭으로 실행하세요.
cd "$(dirname "$0")"

echo "════════════════════════════════════════"
echo "  SHOWRUNNER 시작 준비 중..."
echo "════════════════════════════════════════"

# Node.js 설치 확인
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "❌ Node.js가 설치되어 있지 않습니다."
  echo "   https://nodejs.org 에서 LTS 버전을 먼저 설치한 뒤 이 파일을 다시 더블클릭해 주세요."
  echo ""
  read -p "아무 키나 누르면 창이 닫힙니다..."
  exit 1
fi

# 최초 1회만 패키지 설치 (node_modules가 없을 때만)
if [ ! -d "node_modules" ]; then
  echo "📦 처음 실행이라 필요한 패키지를 설치합니다 (1~2분 정도 걸려요)..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ 설치 중 오류가 발생했습니다."
    read -p "아무 키나 누르면 창이 닫힙니다..."
    exit 1
  fi
fi

# 샘플 데이터가 없으면 시드
if [ ! -f "data/db.json" ]; then
  echo "🌱 샘플 프로젝트(CES 2027)를 생성합니다..."
  npm run seed
fi

echo ""
echo "🚀 서버를 시작합니다. 잠시 후 브라우저가 자동으로 열립니다."
echo "   (이 창을 닫으면 서버가 종료됩니다)"
echo ""

# 서버를 백그라운드로 띄우고, 준비되면 브라우저 오픈
npm run dev &
SERVER_PID=$!

# 서버가 응답할 때까지 대기 후 브라우저 열기
for i in $(seq 1 30); do
  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    open http://localhost:3000
    break
  fi
  sleep 1
done

wait $SERVER_PID
