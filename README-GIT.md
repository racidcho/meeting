# GitHub 업로드 가이드

## 빠른 실행

`setup-git.bat` 파일을 더블클릭하거나, PowerShell에서 실행:

```powershell
.\setup-git.bat
```

## 수동 실행 (배치 파일이 작동하지 않는 경우)

PowerShell에서 `C:\projects\meeting` 디렉토리에서 다음 명령어를 순서대로 실행:

```powershell
# 1. 파일 추가
git add .

# 2. 커밋
git commit -m "Add project files: 상견례 사진 투표 앱"

# 3. GitHub 연결 (아직 안 했다면)
git remote add origin https://github.com/racidcho/meeting.git

# 4. 브랜치 이름 변경
git branch -M main

# 5. GitHub에 푸시
git push -u origin main
```

## 인증 문제 해결

`git push` 시 인증 오류가 발생하면:

1. **Personal Access Token 생성:**
   - https://github.com/settings/tokens 접속
   - "Generate new token (classic)" 클릭
   - Token name: `meeting-app`
   - Expiration: 원하는 기간
   - Scopes: `repo` 체크
   - "Generate token" 클릭
   - **토큰을 복사** (한 번만 표시됨!)

2. **푸시 시 사용:**
   - Username: `racidcho`
   - Password: (복사한 토큰 붙여넣기)

## 확인

성공하면 https://github.com/racidcho/meeting 에서 파일들을 확인할 수 있습니다.

