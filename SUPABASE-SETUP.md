# Supabase 데이터베이스 설정 가이드

## 문제: "방 생성 실패" 오류

이 오류는 Supabase 데이터베이스에 테이블이 생성되지 않아서 발생합니다.

## 해결 방법

### 1단계: Supabase 대시보드 접속

1. https://supabase.com 접속
2. 프로젝트 선택 (https://xtpmtqqzoxprtjdxmvhw.supabase.co)
3. 왼쪽 메뉴에서 **"SQL Editor"** 클릭

### 2단계: SQL 스키마 실행

1. SQL Editor에서 **"New query"** 클릭
2. 아래 SQL 코드를 복사하여 붙여넣기:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  current_round INTEGER,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'finished')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Families table
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (label IN ('신랑네', '신부네', '우리부부')),
  device_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, label)
);

-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rounds table
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  photo_ids UUID[] NOT NULL,
  winning_photo_id UUID REFERENCES photos(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, round_number)
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(round_id, family_id)
);

-- Indexes for better query performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_families_room_id ON families(room_id);
CREATE INDEX idx_photos_room_id ON photos(room_id);
CREATE INDEX idx_rounds_room_id ON rounds(room_id);
CREATE INDEX idx_votes_room_id ON votes(room_id);
CREATE INDEX idx_votes_round_id ON votes(round_id);

-- Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for anonymous access)
CREATE POLICY "Allow all operations on rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on families" ON families FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on photos" ON photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on rounds" ON rounds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on votes" ON votes FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for rooms and votes
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
```

3. **"Run"** 버튼 클릭 (또는 Ctrl + Enter)
4. 성공 메시지 확인

### 3단계: Realtime 활성화 확인

1. 왼쪽 메뉴에서 **"Settings"** > **"API"** 클릭
2. **"Realtime"** 섹션에서 활성화되어 있는지 확인

### 4단계: 테스트

1. 브라우저에서 `http://localhost:3000/host` 새로고침
2. "방 만들기" 버튼 클릭
3. 정상적으로 작동하는지 확인

## 문제 해결

### "relation does not exist" 오류
- SQL 스키마가 실행되지 않았습니다. 2단계를 다시 확인하세요.

### "permission denied" 오류
- RLS 정책이 제대로 생성되지 않았습니다. SQL을 다시 실행하세요.

### Realtime이 작동하지 않음
- Settings > API > Realtime에서 활성화되어 있는지 확인하세요.

