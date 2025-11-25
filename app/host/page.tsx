'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, addPhoto, getPhotosByRoom, generateRounds, getRoundsByRoom, updateRoom, getRoomByCode, getVotesByRound, updateRound, calculateWinningPhoto, getFamiliesByRoom } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import type { Room, Photo, Round, FamilyLabel } from '@/lib/types';
import RouletteModal from '@/app/components/RouletteModal';

export default function HostPage() {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [photoUrls, setPhotoUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Roulette State
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteError, setRouletteError] = useState<string | null>(null);
  const [rouletteLoading, setRouletteLoading] = useState(false);
  const [pendingTieRound, setPendingTieRound] = useState<Round | null>(null);
  const [rouletteTargetWinner, setRouletteTargetWinner] = useState<FamilyLabel | null>(null);

  const handleHostSpin = async () => {
    if (!room || !pendingTieRound) return;
    
    // 1. Pick random winner locally
    const families: FamilyLabel[] = ['신랑네', '신부네', '우리부부'];
    const winner = families[Math.floor(Math.random() * families.length)];
    
    setRouletteTargetWinner(winner);
    
    // 2. Broadcast spin event
    try {
      await supabase.channel(`room:${room.id}`).send({
        type: 'broadcast',
        event: 'spin-roulette',
        payload: { winner, roundId: pendingTieRound.id }
      });
    } catch (err) {
      console.error('Broadcast failed:', err);
      // Continue locally anyway
    }
  };

  const handleRouletteComplete = async () => {
    // Animation finished, now update DB
    if (!room || !pendingTieRound || !rouletteTargetWinner) return;

    try {
      setRouletteLoading(true);
      setRouletteError(null);

      const winnerLabel = rouletteTargetWinner;

      // 1. Find the family ID for the winner label
      const families = await getFamiliesByRoom(room.id);
      const winningFamily = families.find(f => f.label === winnerLabel);
      
      if (!winningFamily) {
        throw new Error('당첨된 가족 정보를 찾을 수 없습니다.');
      }

      // 2. Find what photo they voted for in this round
      const votes = await getVotesByRound(pendingTieRound.id);
      const winningVote = votes.find(v => v.family_id === winningFamily.id);
      
      if (!winningVote) {
        throw new Error(`${winnerLabel}의 투표 정보를 찾을 수 없습니다.`);
      }

      // 3. Update the round with the winning photo
      await updateRound(pendingTieRound.id, {
        winning_photo_id: winningVote.photo_id,
        tie_photos: null // Clear tie status explicitly
      });

      // Update local state
      setRounds((prevRounds) =>
        prevRounds.map((r) =>
          r.id === pendingTieRound.id
            ? { ...r, winning_photo_id: winningVote.photo_id, tie_photos: null }
            : r
        )
      );
      
      // 4. Move to next round or finish (Logic duplicated from handleEndRound, could be refactored)
      const nextRound = pendingTieRound.round_number + 1;
      const hasNextRound = rounds.some((r) => r.round_number === nextRound);

      if (hasNextRound) {
         await updateRoom(room.id, {
           current_round: pendingTieRound.round_number,
           status: 'lobby',
         });
      } else {
         await updateRoom(room.id, {
           status: 'finished',
           current_round: null,
         });
      }
      
      setPendingTieRound(null);
      setShowRoulette(false);
      setRouletteTargetWinner(null);

    } catch (err) {
      console.error('룰렛 결과 처리 실패:', err);
      setRouletteError('결과 처리 중 오류가 발생했습니다.');
      // Do not close modal on error so they can try again? 
      // Actually better to reset spin and let them try again.
      setRouletteTargetWinner(null); 
    } finally {
      setRouletteLoading(false);
    }
  };

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

  const handleAddPhotos = async () => {
    if (!room || !photoUrls.trim()) return;

    // Parse URLs from textarea (split by newline, comma, or space)
    const urls = photoUrls
      .split(/\n|,|\s+/)
      .map((url) => url.trim())
      .filter((url) => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));

    if (urls.length === 0) {
      setError('유효한 이미지 URL을 입력해주세요.');
      return;
    }

    // Check if adding these photos would exceed the limit
    if (photos.length + urls.length > 30) {
      setError(`최대 30장까지 등록 가능합니다. (현재: ${photos.length}장, 추가 시도: ${urls.length}장)`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Add all photos sequentially
      const newPhotos: Photo[] = [];
      for (let i = 0; i < urls.length; i++) {
        const newPhoto = await addPhoto({
          room_id: room.id,
          url: urls[i],
          order_index: photos.length + i,
        });
        newPhotos.push(newPhoto);
      }
      
      setPhotos([...photos, ...newPhotos]);
      setPhotoUrls('');
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

    // Check for existing tie
    const currentRound = rounds.find((r) => r.id === roundId);
    if (currentRound && currentRound.tie_photos && currentRound.tie_photos.length > 0) {
      setPendingTieRound(currentRound);
      setShowRoulette(true);
      return;
    }
    
    // Check if already finished (has winner) - Just advance state
    if (currentRound && currentRound.winning_photo_id) {
      try {
        setLoading(true);
        // Move to next round or finish
        const nextRound = roundNumber + 1;
        const hasNextRound = rounds.some((r) => r.round_number === nextRound);

        if (hasNextRound) {
          await updateRoom(room.id, {
            current_round: roundNumber,
            status: 'lobby',
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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '라운드 종료 실패');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get votes for this round
      const votes = await getVotesByRound(roundId);
      
      // Calculate winning photo (most votes) with tie handling
      if (votes.length > 0) {
        const { winningPhotoId, isTie, tiePhotos } = calculateWinningPhoto(votes);

        // Update round with winning photo or tie information
        if (isTie) {
          // 동점인 경우: winning_photo_id는 null, tie_photos에 동점 사진들 저장
          await updateRound(roundId, {
            winning_photo_id: null,
            tie_photos: tiePhotos,
          });
          
          // Update local state immediately to reflect tie
          const updatedRound = { ...currentRound!, tie_photos: tiePhotos, winning_photo_id: null };
          setRounds((prev) => prev.map((r) => r.id === roundId ? updatedRound : r));
          setPendingTieRound(updatedRound);
          setShowRoulette(true);
          setError('동점입니다! 룰렛으로 승자를 결정해주세요.');
          return; // Stop here to handle roulette
        } else {
          // 동점이 아닌 경우: winning_photo_id 저장, tie_photos는 null
          await updateRound(roundId, {
            winning_photo_id: winningPhotoId,
            tie_photos: null,
          });
        }
      }
      
      // Move to next round or finish
      const nextRound = roundNumber + 1;
      const hasNextRound = rounds.some((r) => r.round_number === nextRound);

      if (hasNextRound) {
        await updateRoom(room.id, {
          current_round: roundNumber,
          status: 'lobby',
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
          <div className="space-y-3">
            <div className="flex gap-2">
              <textarea
                value={photoUrls}
                onChange={(e) => setPhotoUrls(e.target.value)}
                placeholder="이미지 URL을 입력하세요.&#10;여러 개를 등록하려면 줄바꿈, 쉼표, 또는 공백으로 구분하세요.&#10;예:&#10;https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-y min-h-[100px]"
                rows={5}
              />
              <button
                onClick={handleAddPhotos}
                disabled={loading || !photoUrls.trim() || photos.length >= 30}
                className="px-6 py-2 bg-gold text-white rounded-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50 self-start"
              >
                추가
              </button>
            </div>
            <p className="text-sm text-gray-500">
              💡 여러 사진을 한 번에 등록하려면 각 URL을 줄바꿈, 쉼표, 또는 공백으로 구분하세요.
            </p>
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
                const unfinishedRounds = rounds.filter(
                  (r) =>
                    !r.winning_photo_id &&
                    (!r.tie_photos || r.tie_photos.length === 0)
                );
                const nextRoundToStart = unfinishedRounds[0];
                const canStart =
                  room.status === 'lobby' &&
                  nextRoundToStart &&
                  nextRoundToStart.id === round.id;
                const canEnd =
                  isCurrentRound &&
                  room.status === 'in_progress';
                
                const isTie = round.tie_photos && round.tie_photos.length > 0;

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
                        {isTie && !round.winning_photo_id && (
                          <p className="text-sm text-red-600 font-bold">⚠️ 1:1:1 동점 (룰렛 필요)</p>
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
                        {isTie && !round.winning_photo_id && (
                          <button
                            onClick={() => {
                              setPendingTieRound(round);
                              setShowRoulette(true);
                            }}
                            className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-opacity-90 transition animate-pulse"
                          >
                            🎲 룰렛 돌리기
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {room.status === 'finished' && (
              <button
                onClick={() => router.push(`/room/${room.code}/result`)}
                className="mt-4 w-full px-6 py-4 bg-gold text-white rounded-lg text-lg font-semibold hover:bg-opacity-90 transition"
              >
                결과 보기
              </button>
            )}
          </div>
        )}
        
        {/* Roulette Modal */}
        {showRoulette && pendingTieRound && (
          <RouletteModal
            roundNumber={pendingTieRound.round_number}
            onClose={() => {
              if (!rouletteLoading) setShowRoulette(false);
            }}
            onComplete={handleRouletteComplete}
            targetWinner={rouletteTargetWinner}
            onRequestSpin={handleHostSpin}
          />
        )}
      </div>
    </div>
  );
}

