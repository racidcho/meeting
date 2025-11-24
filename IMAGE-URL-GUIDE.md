# 이미지 URL 생성 가이드

## 방법 1: 온라인 이미지 호스팅 서비스 사용 (가장 쉬움)

### Imgur 사용 (무료, 추천)

1. https://imgur.com 접속
2. "New post" 클릭
3. 이미지 업로드
4. 업로드 후 이미지 우클릭 > "Copy image address" 또는 "Copy image link"
5. 복사한 URL을 앱에 붙여넣기

**예시 URL 형식:**
```
https://i.imgur.com/abc123.jpg
```

### Cloudinary 사용 (무료, 고급)

1. https://cloudinary.com 접속
2. 무료 계정 생성
3. Media Library에서 이미지 업로드
4. 업로드한 이미지 클릭 > "Copy URL" 클릭
5. 복사한 URL 사용

### Google Photos (공유 링크)

1. Google Photos에서 이미지 선택
2. "공유" 클릭
3. "링크 만들기" 클릭
4. 생성된 링크 사용 (직접 이미지 URL이 아닐 수 있음)

## 방법 2: Supabase Storage 사용 (프로젝트와 통합)

Supabase Storage를 사용하면 프로젝트와 함께 관리할 수 있습니다.

### 설정 방법

1. Supabase 대시보드 > Storage
2. 새 버킷 생성 (예: "photos")
3. Public으로 설정
4. 이미지 업로드
5. 업로드한 이미지의 Public URL 복사

**URL 형식:**
```
https://xtpmtqqzoxprtjdxmvhw.supabase.co/storage/v1/object/public/photos/image.jpg
```

## 방법 3: 로컬 개발용 (임시)

로컬에서 테스트할 때만 사용:

1. 온라인 이미지 호스팅 서비스 사용 (방법 1)
2. 또는 공개 이미지 URL 사용 (예: Unsplash)

### Unsplash 무료 이미지 사용

```
https://images.unsplash.com/photo-1234567890?w=800
```

## 방법 4: 직접 이미지 업로드 기능 추가 (고급)

앱에 직접 이미지 업로드 기능을 추가할 수도 있습니다. 이 경우:
- Supabase Storage 사용
- 또는 다른 클라우드 스토리지 서비스 사용

## 추천

**빠른 테스트:** Imgur 사용 (방법 1)
**프로덕션:** Supabase Storage 사용 (방법 2)

## 주의사항

- 이미지 URL은 **공개적으로 접근 가능**해야 합니다
- 로컬 파일 경로(`file://` 또는 `C:\`)는 작동하지 않습니다
- HTTPS URL을 사용하는 것이 좋습니다

