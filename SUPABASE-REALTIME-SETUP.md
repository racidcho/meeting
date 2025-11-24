# Supabase Realtime 활성화 가이드

## 방법 1: SQL로 활성화 (권장)

### 1단계: Supabase 대시보드 접속
1. https://supabase.com 접속
2. 프로젝트 선택 (https://xtpmtqqzoxprtjdxmvhw.supabase.co)
3. 왼쪽 메뉴에서 **"SQL Editor"** 클릭

### 2단계: Realtime 활성화 SQL 실행

SQL Editor에서 다음 SQL을 실행하세요:

```sql
-- Realtime 활성화 (이미 schema.sql에 포함되어 있지만, 확인용)
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
```

**참고:** 이미 `schema.sql`을 실행했다면 이 단계는 건너뛰어도 됩니다.

## 방법 2: 대시보드에서 확인

### 1단계: Database 설정 확인
1. Supabase 대시보드 접속
2. 왼쪽 메뉴에서 **"Database"** > **"Replication"** 클릭
3. `rooms`와 `votes` 테이블이 목록에 있는지 확인

### 2단계: Realtime 활성화 (필요한 경우)
1. **"Database"** > **"Replication"** 메뉴로 이동
2. 테이블 목록에서 `rooms`와 `votes` 찾기
3. 각 테이블의 **"Enable Realtime"** 토글을 켜기

## 방법 3: API 설정 확인

### 1단계: API 설정 확인
1. 왼쪽 메뉴에서 **"Settings"** > **"API"** 클릭
2. **"Realtime"** 섹션 확인
3. Realtime이 활성화되어 있는지 확인

## 확인 방법

### 방법 1: SQL로 확인
SQL Editor에서 다음 쿼리 실행:

```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

결과에 `rooms`와 `votes` 테이블이 표시되어야 합니다.

### 방법 2: 대시보드에서 확인
1. **"Database"** > **"Replication"** 메뉴로 이동
2. `rooms`와 `votes` 테이블이 목록에 있고 활성화되어 있는지 확인

## 문제 해결

### Realtime이 작동하지 않는 경우

1. **테이블이 Realtime 목록에 없는 경우**
   - SQL Editor에서 위의 `ALTER PUBLICATION` 명령어 실행

2. **권한 문제**
   - Supabase 프로젝트의 권한 설정 확인
   - RLS 정책이 올바르게 설정되어 있는지 확인

3. **연결 문제**
   - 브라우저 콘솔에서 WebSocket 연결 확인
   - 네트워크 탭에서 WebSocket 연결 상태 확인

## 테스트 방법

### 브라우저 콘솔에서 테스트

1. 개발자 도구 열기 (F12)
2. Console 탭에서 다음 코드 실행:

```javascript
// Supabase 클라이언트 확인
import { supabase } from '@/lib/supabaseClient';

// Realtime 구독 테스트
const channel = supabase
  .channel('test-channel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'rooms'
  }, (payload) => {
    console.log('Realtime 이벤트:', payload);
  })
  .subscribe();

console.log('Realtime 구독 상태:', channel.state);
```

3. 다른 탭에서 방을 생성하거나 수정
4. 콘솔에 Realtime 이벤트가 표시되는지 확인

## 주의사항

- Realtime은 **무료 플랜에서도 사용 가능**합니다
- Realtime은 **WebSocket 연결**을 사용합니다
- 방화벽이나 프록시가 WebSocket을 차단하지 않는지 확인하세요

## 추가 정보

- Supabase Realtime 문서: https://supabase.com/docs/guides/realtime
- WebSocket 연결 문제 해결: https://supabase.com/docs/guides/realtime/troubleshooting

