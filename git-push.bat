@echo off
chcp 65001 >nul
echo ========================================
echo Git 변경사항 커밋 및 푸시
echo ========================================
echo.

cd /d "C:\projects\meeting"

echo [1/4] 변경사항 확인...
git status

echo.
echo [2/4] 모든 변경사항 추가...
git add .

echo.
echo [3/4] 커밋 생성...
git commit -m "개선: 방 코드 불러오기 기능 추가 및 UI 개선"

if %errorlevel% neq 0 (
    echo 경고: 커밋 실패 (변경사항이 없을 수 있음)
)

echo.
echo [4/4] GitHub에 푸시...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 성공! GitHub에 업로드되었습니다.
    echo https://github.com/racidcho/meeting
    echo ========================================
) else (
    echo.
    echo ========================================
    echo 푸시 실패. 인증 문제일 수 있습니다.
    echo GitHub Personal Access Token이 필요합니다.
    echo ========================================
)

pause

