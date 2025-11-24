@echo off
echo Git 저장소 설정을 시작합니다...
echo.

cd /d "C:\projects\meeting"

echo [1/6] 파일 추가 중...
git add .
if %errorlevel% neq 0 (
    echo 오류: git add 실패
    pause
    exit /b 1
)

echo [2/6] 커밋 생성 중...
git commit -m "Add project files: 상견례 사진 투표 앱"
if %errorlevel% neq 0 (
    echo 오류: git commit 실패
    pause
    exit /b 1
)

echo [3/6] GitHub 저장소 연결 확인 중...
git remote -v | findstr "origin" >nul
if %errorlevel% neq 0 (
    echo GitHub 저장소 연결 중...
    git remote add origin https://github.com/racidcho/meeting.git
    if %errorlevel% neq 0 (
        echo 오류: git remote add 실패
        pause
        exit /b 1
    )
) else (
    echo GitHub 저장소가 이미 연결되어 있습니다.
)

echo [4/6] 브랜치 이름 변경 중...
git branch -M main
if %errorlevel% neq 0 (
    echo 경고: 브랜치 이름 변경 실패 (이미 main일 수 있음)
)

echo [5/6] 상태 확인...
git status

echo.
echo [6/6] GitHub에 푸시합니다...
echo 인증이 필요할 수 있습니다. GitHub Personal Access Token을 준비하세요.
echo.
git push -u origin main

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
    echo https://github.com/settings/tokens
    echo ========================================
)

pause

