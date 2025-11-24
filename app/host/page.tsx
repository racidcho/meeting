'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, addPhoto, getPhotosByRoom, generateRounds, getRoundsByRoom, updateRoom, getRoomByCode, getVotesByRound, updateRound } from '@/lib/utils';
import type { Room, Photo, Round } from '@/lib/types';

export default function HostPage() {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setError(null);
      const newRoom = await createRoom();
      setRoom(newRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : '방 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!room || !photoUrl.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const newPhoto = await addPhoto({
        room_id: room.id,
        url: photoUrl.trim(),
        order_index: photos.length,
      });
      setPhotos([...photos, newPhoto]);
      setPhotoUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 추가 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRounds = async () => {
    if (!room || photos.length < 3) {
      setError('최소 3장의 사진이 필요합니다.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newRounds = await generateRounds(room.id, photos);
      setRounds(newRounds);
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRound = async (roundNumber: number) => {
    if (!room) return;

    try {
      setLoading(true);
      setError(null);
      await updateRoom(room.id, {
        current_round: roundNumber,
        status: 'in_progress',
      });
      const updatedRoom = await getRoomByCode(room.code);
      if (updatedRoom) setRoom(updatedRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 시작 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleEndRound = async (roundId: string, roundNumber: number) => {
    if (!room) return;

    try {
      setLoading(true);
      setError(null);
      
      // Get votes for this round
      const votes = await getVotesByRound(roundId);
      
      // Calculate winning photo (most votes)
      if (votes.length > 0) {
        const voteCounts: Record<string, number> = {};
        votes.forEach((vote) => {
          voteCounts[vote.photo_id] = (voteCounts[vote.photo_id] || 0) + 1;
        });

        const winningPhotoId = Object.entries(voteCounts).reduce((a, b) =>
          voteCounts[a[0]] > voteCounts[b[0]] ? a : b
        )[0];

        // Update round with winning photo
        await updateRound(roundId, {
          winning_photo_id: winningPhotoId,
        });
      }
      
      // Move to next round or finish
      const nextRound = roundNumber + 1;
      const hasNextRound = rounds.some((r) => r.round_number === nextRound);

      if (hasNextRound) {
        await updateRoom(room.id, {
          current_round: nextRound,
          status: 'in_progress',
        });
      } else {
        await updateRoom(room.id, {
          status: 'finished',
          current_round: null,
        });
      }

      // Reload data
      const updatedRoom = await getRoomByCode(room.code);
      if (updatedRoom) {
        setRoom(updatedRoom);
        const roomRounds = await getRoundsByRoom(updatedRoom.id);
        setRounds(roomRounds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 종료 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomData = async (roomCode: string) => {
    try {
      const roomData = await getRoomByCode(roomCode);
      if (roomData) {
        setRoom(roomData);
        const roomPhotos = await getPhotosByRoom(roomData.id);
        setPhotos(roomPhotos);
        const roomRounds = await getRoundsByRoom(roomData.id);
        setRounds(roomRounds);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로드 실패');
    }
  };

  useEffect(() => {
    // Check if room code is in localStorage
    const savedRoomCode = localStorage.getItem('hostRoomCode');
    if (savedRoomCode) {
      loadRoomData(savedRoomCode);
    }
  }, []);

  useEffect(() => {
    if (room) {
      localStorage.setItem('hostRoomCode', room.code);
    }
  }, [room]);

  if (!room) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-3xl font-bold text-center text-gold mb-8">
            호스트 모드
          </h1>
          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full px-6 py-4 bg-gold text-white rounded-lg text-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
          >
            {loading ? '생성 중...' : '방 만들기'}
          </button>
          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold mb-2">호스트 모드</h1>
          <div className="text-2xl font-semibold text-gray-700">
            방 코드: <span className="text-gold">{room.code}</span>
          </div>
          <button
            onClick={() => router.push(`/room/${room.code}/host`)}
            className="mt-4 px-6 py-2 bg-beige text-gray-800 rounded-lg font-semibold hover:bg-opacity-90 transition"
          >
            호스트 화면 열기
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Photo Upload Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">사진 등록 ({photos.length}/30)</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="이미지 URL 입력"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              onKeyPress={(e) => e.key === 'Enter' && handleAddPhoto()}
            />
            <button
              onClick={handleAddPhoto}
              disabled={loading || !photoUrl.trim() || photos.length >= 30}
              className="px-6 py-2 bg-gold text-white rounded-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              추가
            </button>
          </div>
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={`Photo ${photo.order_index + 1}`}
                  className="w-full h-24 object-cover rounded"
                />
              ))}
            </div>
          )}
        </div>

        {/* Rounds Section */}
        {photos.length >= 3 && rounds.length === 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">라운드 생성</h2>
            <button
              onClick={handleGenerateRounds}
              disabled={loading}
              className="w-full px-6 py-4 bg-gold text-white rounded-lg text-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {loading ? '생성 중...' : '라운드 생성하기'}
            </button>
          </div>
        )}

        {/* Rounds List */}
        {rounds.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">라운드 관리</h2>
            <div className="space-y-3">
              {rounds.map((round) => {
                const isCurrentRound = room.current_round === round.round_number;
                const isFinished = room.status === 'finished';
                const canStart = !isCurrentRound && room.status !== 'in_progress';
                const canEnd = isCurrentRound && room.status === 'in_progress';

                return (
                  <div
                    key={round.id}
                    className={`p-4 border-2 rounded-lg ${
                      isCurrentRound
                        ? 'border-gold bg-gold bg-opacity-10'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          라운드 {round.round_number}
                        </h3>
                        {round.winning_photo_id && (
                          <p className="text-sm text-gray-600">✅ 완료</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {canStart && (
                          <button
                            onClick={() => handleStartRound(round.round_number)}
                            disabled={loading}
                            className="px-4 py-2 bg-gold text-white rounded-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
                          >
                            시작
                          </button>
                        )}
                        {canEnd && (
                          <button
                            onClick={() => handleEndRound(round.id, round.round_number)}
                            disabled={loading}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
                          >
                            종료
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {isFinished && (
              <button
                onClick={() => router.push(`/room/${room.code}/result`)}
                className="mt-4 w-full px-6 py-4 bg-gold text-white rounded-lg text-lg font-semibold hover:bg-opacity-90 transition"
              >
                결과 보기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

