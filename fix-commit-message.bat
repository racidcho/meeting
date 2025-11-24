@echo off
chcp 65001 >nul
echo ========================================
echo Git 인코딩 설정 및 커밋 메시지 수정
echo ========================================
echo.

cd /d "C:\projects\meeting"

echo [1/4] Git 인코딩 설정 중...
git config core.quotepath false
git config i18n.commitencoding utf-8
git config i18n.logoutputencoding utf-8
git config --global core.quotepath false
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8

echo [2/4] 설정 확인...
git config --list | findstr "encoding"

echo.
echo [3/4] 마지막 커밋 메시지 수정 중...
git commit --amend -m "Add project files: 상견례 사진 투표 앱"

if %errorlevel% neq 0 (
    echo 오류: 커밋 메시지 수정 실패
    pause
    exit /b 1
)

echo.
echo [4/4] GitHub에 강제 푸시합니다...
echo 주의: 이 작업은 원격 저장소의 커밋 히스토리를 덮어씁니다.
echo.
pause

git push -f origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo 성공! 커밋 메시지가 수정되었습니다.
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

