@echo off
chcp 65001 >nul
echo ========================================
echo Git Push to GitHub
echo ========================================
echo.

cd /d "C:\Users\라시드\Downloads\meeting"

echo [1/4] 현재 상태 확인...
git status
echo.

echo [2/4] 변경사항 스테이징...
git add .
if %errorlevel% neq 0 (
    echo 오류: git add 실패
    pause
    exit /b 1
)
echo 완료!
echo.

echo [3/4] 커밋 생성...
git commit -m "fix: Resolve all build errors and update features"
if %errorlevel% neq 0 (
    echo 경고: 커밋할 변경사항이 없거나 이미 커밋되었습니다.
)
echo.

echo [4/4] GitHub로 푸시...
git push origin main --force
if %errorlevel% neq 0 (
    echo 오류: git push 실패
    pause
    exit /b 1
)
echo.

echo ========================================
echo 완료! Vercel이 자동으로 배포를 시작합니다.
echo ========================================
pause
