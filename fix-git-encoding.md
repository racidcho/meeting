# Git 한글 인코딩 문제 해결

## 문제
커밋 메시지나 파일명의 한글이 깨져서 표시되는 경우

## 해결 방법

### 1. Git 전역 설정 (모든 저장소에 적용)

PowerShell에서 실행:

```powershell
# Git 인코딩을 UTF-8로 설정
git config --global core.quotepath false
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8

# Windows 콘솔 인코딩 설정
git config --global core.autocrlf true
```

### 2. 현재 저장소만 설정

```powershell
cd C:\projects\meeting
git config core.quotepath false
git config i18n.commitencoding utf-8
git config i18n.logoutputencoding utf-8
```

### 3. PowerShell 인코딩 설정

PowerShell에서 실행:

```powershell
# PowerShell 출력 인코딩을 UTF-8로 설정
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:LANG = "ko_KR.UTF-8"
```

### 4. 이미 깨진 커밋 메시지 수정 (선택사항)

마지막 커밋 메시지만 수정하려면:

```powershell
git commit --amend -m "Add project files: 상견례 사진 투표 앱"
git push -f origin main
```

**주의:** `-f` 옵션은 강제 푸시이므로 신중하게 사용하세요.

## 확인

설정이 제대로 되었는지 확인:

```powershell
git config --list | Select-String "encoding"
```

다음과 같이 표시되어야 합니다:
- `i18n.commitencoding=utf-8`
- `i18n.logoutputencoding=utf-8`
- `core.quotepath=false`

## 앞으로 커밋할 때

이제 한글 커밋 메시지가 정상적으로 표시됩니다:

```powershell
git commit -m "한글 메시지 테스트"
```

