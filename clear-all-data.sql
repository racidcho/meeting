-- 방법 1: TRUNCATE 사용 (빠르고 효율적, 권장)
-- 모든 테이블의 데이터를 한 번에 삭제
-- CASCADE 옵션으로 외래키 제약조건도 함께 처리

TRUNCATE TABLE votes CASCADE;
TRUNCATE TABLE rounds CASCADE;
TRUNCATE TABLE photos CASCADE;
TRUNCATE TABLE families CASCADE;
TRUNCATE TABLE rooms CASCADE;

-- 방법 2: DELETE 사용 (더 안전하지만 느림)
-- 외래키 순서를 고려하여 역순으로 삭제
/*
DELETE FROM votes;
DELETE FROM rounds;
DELETE FROM photos;
DELETE FROM families;
DELETE FROM rooms;
*/

-- 확인: 모든 테이블이 비어있는지 확인
SELECT 
  'rooms' as table_name, COUNT(*) as count FROM rooms
UNION ALL
SELECT 'families', COUNT(*) FROM families
UNION ALL
SELECT 'photos', COUNT(*) FROM photos
UNION ALL
SELECT 'rounds', COUNT(*) FROM rounds
UNION ALL
SELECT 'votes', COUNT(*) FROM votes;

