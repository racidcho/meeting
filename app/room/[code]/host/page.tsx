'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getRoomByCode,
  getRoundByRoomAndNumber,
  getPhotosByRoom,
  getFamiliesByRoom,
  getVotesByRound,
  updateRound,
  updateRoom,
  getRoundsByRoom,
  calculateWinningPhoto,
} from '@/lib/utils';
import type { Room, Round, Photo, Family, Vote, FamilyLabel } from '@/lib/types';
import RouletteModal from '@/app/components/RouletteModal';

export default function HostViewPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRoundNumber, setNextRoundNumber] = useState<number | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteError, setRouletteError] = useState<string | null>(null);
  const [rouletteLoading, setRouletteLoading] = useState(false);
  const [rouletteTargetWinner, setRouletteTargetWinner] = useState<FamilyLabel | null>(null);

  // Load initial data
  useEffect(() => {
    if (!code) return;

    const loadData = async () => {
      try {
        const roomData = await getRoomByCode(code);
        if (roomData) {
          setRoom(roomData);
          const familiesData = await getFamiliesByRoom(roomData.id);
          setFamilies(familiesData);

          if (roomData.current_round) {
            await loadRoundData(roomData.id, roomData.current_round);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 로드 실패');
      }
    };

    loadData();
  }, [code]);

  // Subscribe to room changes
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        async (payload) => {
          const updatedRoom = payload.new as Room;
          setRoom(updatedRoom);

          if (updatedRoom.current_round) {
            await loadRoundData(updatedRoom.id, updatedRoom.current_round);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // Subscribe to votes
  useEffect(() => {
    if (!currentRound) return;

    const channel = supabase
      .channel(`votes:${currentRound.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `round_id=eq.${currentRound.id}`,
        },
        async () => {
          const votesData = await getVotesByRound(currentRound.id);
          setVotes(votesData);
        }
      )
      .subscribe();

    // Load initial votes
    const loadVotes = async () => {
      const votesData = await getVotesByRound(currentRound.id);
      setVotes(votesData);
    };
    loadVotes();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRound]);

  const loadRoundData = async (roomId: string, roundNumber: number) => {
    try {
      const round = await getRoundByRoomAndNumber(roomId, roundNumber);
      if (round) {
        setCurrentRound(round);
        const allPhotos = await getPhotosByRoom(roomId);
        const roundPhotos = allPhotos.filter((p) =>
          round.photo_ids.includes(p.id)
        );
        setPhotos(roundPhotos);

        const allRounds = await getRoundsByRoom(roomId);
        const possibleNext = round.round_number + 1;
        const hasNext = allRounds.some((r) => r.round_number === possibleNext);
        setNextRoundNumber(hasNext ? possibleNext : null);
        setShowRoulette(false);
        setRouletteError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '���� �ε� ����');
    }
  };

  const handleHostSpin = async () => {
    if (!room || !currentRound) return;
    
    // 1. Pick random winner locally
    const families: FamilyLabel[] = ['신랑네', '신부네', '우리부부'];
    const winner = families[Math.floor(Math.random() * families.length)];
    
    setRouletteTargetWinner(winner);
    
    // 2. Broadcast spin event
    try {
      await supabase.channel(`room:${room.id}`).send({
        type: 'broadcast',
        event: 'spin-roulette',
        payload: { winner, roundId: currentRound.id }
      });
    } catch (err) {
      console.error('Broadcast failed:', err);
    }
  };

  const handleRouletteComplete = async () => {
    if (!room || !currentRound || !rouletteTargetWinner) return;

    try {
      setRouletteLoading(true);
      setRouletteError(null);

      const winnerLabel = rouletteTargetWinner;
      const winningFamily = families.find((f) => f.label === winnerLabel);
      if (!winningFamily) {
        throw new Error('당첨된 가족 정보를 찾을 수 없습니다.');
      }

      const votesData = await getVotesByRound(currentRound.id);
      const winningVote = votesData.find((v) => v.family_id === winningFamily.id);
      if (!winningVote) {
        throw new Error(`${winnerLabel}의 투표 정보를 찾을 수 없습니다.`);
      }

      await updateRound(currentRound.id, {
        winning_photo_id: winningVote.photo_id,
        tie_photos: null,
      });

      setVotes(votesData);
      setCurrentRound((prev) =>
        prev
          ? { ...prev, winning_photo_id: winningVote.photo_id, tie_photos: null }
          : prev
      );
      setShowRoulette(false);
      setRouletteTargetWinner(null);
    } catch (err) {
      setRouletteError(
        err instanceof Error ? err.message : '룰렛 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setRouletteLoading(false);
    }
  };

  const handleEndRound = async () => {
    if (!room || !currentRound) return;
    
    if (currentRound.tie_photos && currentRound.tie_photos.length > 0) {
      setError('동점입니다. 룰렛으로 승자를 결정한 뒤 다시 시도하세요.');
      return;
    }

    // Check if all families have voted
    if (families.length > 0 && votes.length < families.length) {
      setError('모든 가족이 투표할 때까지 기다려주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Calculate winning photo (most votes) with tie handling
      const { winningPhotoId, isTie, tiePhotos } = calculateWinningPhoto(votes);

      // Update round with winning photo or tie information
      if (isTie || !winningPhotoId) {
        await updateRound(currentRound.id, {
          winning_photo_id: null,
          tie_photos: tiePhotos,
        });
        setCurrentRound((prev) =>
          prev ? { ...prev, winning_photo_id: null, tie_photos: tiePhotos } : prev
        );
        setError('동점입니다! 룰렛을 돌려 승자를 결정해주세요.');
        return;
      } else if (!currentRound.winning_photo_id) {
        await updateRound(currentRound.id, {
          winning_photo_id: winningPhotoId,
          tie_photos: null,
        });
      }

      // Update room status
      const nextRound = currentRound.round_number + 1;
      const allRounds = await getRoundsByRoom(room.id);
      const hasNextRound = allRounds.some((r) => r.round_number === nextRound);

      if (hasNextRound) {
        await updateRoom(room.id, {
          current_round: currentRound.round_number,
          status: 'lobby',
        });
        const updatedRoom = await getRoomByCode(room.code);
        if (updatedRoom) setRoom(updatedRoom);
      } else {
        // All rounds finished
        await updateRoom(room.id, {
          status: 'finished',
          current_round: null,
        });
        router.push(`/room/${code}/result`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 종료 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleStartNextRound = async () => {
    if (!room || nextRoundNumber === null) return;

    try {
      setLoading(true);
      setError(null);

      await updateRoom(room.id, {
        current_round: nextRoundNumber,
        status: 'in_progress',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '���� ���� ����');
    } finally {
      setLoading(false);
    }
  };

  if (!room) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (!room.current_round || !currentRound) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gold">호스트 화면</h1>
          <p className="text-gray-600">라운드가 시작되기를 기다리는 중...</p>
          <button
            onClick={() => router.push('/host')}
            className="px-6 py-2 bg-beige text-gray-800 rounded-lg font-semibold"
          >
            호스트 관리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // Get vote summary
  const voteSummary = families.map((family) => {
    const vote = votes.find((v) => v.family_id === family.id);
    const photo = vote ? photos.find((p) => p.id === vote.photo_id) : null;
    return { family, vote, photo };
  });

  const tiePending = Boolean(currentRound.tie_photos && currentRound.tie_photos.length > 0);
  const allVoted = families.length > 0 && voteSummary.every((vs) => vs.vote);

  return (
    <div className="min-h-screen p-4 bg-beige">
      <div className="max-w-6xl mx-auto space-y-6">
        {showRoulette && (
          <RouletteModal
            roundNumber={currentRound.round_number}
            onClose={() => {
              if (!rouletteLoading) setShowRoulette(false);
            }}
            onComplete={handleRouletteComplete}
            targetWinner={rouletteTargetWinner}
            onRequestSpin={handleHostSpin}
          />
        )}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold mb-2">호스트 화면</h1>
          <p className="text-xl text-gray-700">
            라운드 {currentRound.round_number}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Photos Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {photos.map((photo, index) => {
            const votesForPhoto = votes.filter((v) => v.photo_id === photo.id);
            const familiesForPhoto = votesForPhoto.map((v) => {
              const family = families.find((f) => f.id === v.family_id);
              return family?.label;
            });

            return (
              <div
                key={photo.id}
                className="bg-white rounded-lg p-4 shadow-lg"
              >
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-64 object-cover rounded mb-2"
                />
                <div className="text-center">
                  <p className="font-semibold text-lg mb-2">사진 {index + 1}번</p>
                  {familiesForPhoto.length > 0 && (
                    <div className="space-y-1">
                      {familiesForPhoto.map((label) => (
                        <span
                          key={label}
                          className="inline-block px-2 py-1 bg-gold text-white rounded text-sm mr-1"
                        >
                          {label} ✓
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Vote Status */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">투표 현황</h2>
          <div className="space-y-2">
            {voteSummary.map(({ family, vote, photo }) => (
              <div
                key={family.id}
                className={`p-3 rounded-lg ${
                  vote ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{family.label}</span>
                  {vote && photo ? (
                    <span className="text-gold font-semibold">
                      사진 {photos.findIndex((p) => p.id === photo.id) + 1}번
                      선택 ✓
                    </span>
                  ) : (
                    <span className="text-gray-500">대기 중...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {tiePending && (
          <div className="bg-pink-50 border-2 border-pink-200 rounded-lg p-6 text-center shadow-inner space-y-2">
            <p className="text-xl font-bold text-pink-700">⚖️ 1:1:1 동점입니다!</p>
            <p className="text-sm text-pink-600">
              아래 버튼을 눌러 룰렛을 돌리면 자동으로 승자가 기록됩니다.
            </p>
            {rouletteError && (
              <p className="text-sm text-red-600">{rouletteError}</p>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowRoulette(true)}
                disabled={rouletteLoading}
                className="px-6 py-3 bg-gradient-to-r from-gold to-yellow-600 text-white rounded-full font-bold shadow hover:scale-105 transition disabled:opacity-60"
              >
                {rouletteLoading ? '룰렛 준비 중...' : '🎲 룰렛 돌리기'}
              </button>
              <button
                onClick={() => setShowRoulette(false)}
                disabled={rouletteLoading}
                className="px-4 py-2 text-sm text-pink-600 underline"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Discussion and End Round Buttons */}
        {room.status === 'in_progress' && allVoted && (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <p className="text-lg font-semibold text-green-700 mb-2">
                모든 가족이 선택을 완료했습니다!
              </p>
              <p className="text-sm text-green-600 mb-4">
                각 가족이 선택한 사진을 확인하고 이야기를 나눠보세요.
              </p>
              <button
                onClick={() => router.push(`/room/${code}/discussion`)}
                className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-opacity-90 transition"
              >
                선택 결과 보기
              </button>
            </div>
            <div className="text-gray-500 text-sm">
              호스트가 라운드를 종료하면 다음 라운드를 시작할 수 있습니다.
            </div>
            <button
              onClick={handleEndRound}
              disabled={loading}
              className="px-8 py-4 bg-gold text-white rounded-lg text-xl font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {loading ? '처리 중...' : '라운드 종료'}
            </button>
          </div>
        )}

        {room.status === 'lobby' && nextRoundNumber && (
          <div className="text-center space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-lg font-semibold text-blue-700 mb-2">
                토론이 끝나면 다음 라운드를 시작하세요.
              </p>
              <p className="text-sm text-blue-600 mb-4">
                시작 버튼을 눌러야 모든 가족이 라운드 {nextRoundNumber} 투표 화면으로 이동합니다.
              </p>
              <button
                onClick={handleStartNextRound}
                disabled={loading}
                className="px-8 py-4 bg-blue-500 text-white rounded-lg text-xl font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {loading ? '시작 준비...' : `라운드 ${nextRoundNumber} 시작`}
              </button>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push('/host')}
            className="px-6 py-2 bg-beige text-gray-800 rounded-lg font-semibold hover:bg-opacity-90 transition"
          >
            호스트 관리로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

