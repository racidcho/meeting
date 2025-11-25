'use client';

import { useState, useEffect, useRef } from 'react';
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
import confetti from 'canvas-confetti';
import RouletteModal from '@/app/components/RouletteModal';

export default function DiscussionPage() {
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
  const [isHost, setIsHost] = useState(false);
  const [nextRoundNumber, setNextRoundNumber] = useState<number | null>(null);
  const lastRoundNumberRef = useRef<number | null>(null);
  const celebratedRoundsRef = useRef<Set<string>>(new Set());

  // Roulette State
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteTargetWinner, setRouletteTargetWinner] = useState<FamilyLabel | null>(null);

  // Check if user is host (from localStorage)
  useEffect(() => {
    const savedRoomCode = localStorage.getItem('hostRoomCode');
    setIsHost(savedRoomCode === code);
  }, [code]);

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
            // Initialize last round number before loading
            lastRoundNumberRef.current = roomData.current_round;
            await loadRoundData(roomData.id, roomData.current_round);
            // Ensure votes are loaded after round data is set
            const round = await getRoundByRoomAndNumber(roomData.id, roomData.current_round);
            if (round) {
              const votesData = await getVotesByRound(round.id);
              setVotes(votesData);
            }
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
          const previousRoundNumber = lastRoundNumberRef.current;
          setRoom(updatedRoom);

          if (updatedRoom.current_round) {
            const isNewRound = previousRoundNumber !== null && 
                              updatedRoom.current_round > previousRoundNumber;
            
            // All users (including host) automatically return to the voting screen when new round starts
            if (isNewRound) {
              console.log('[Discussion] New round detected:', previousRoundNumber, '->', updatedRoom.current_round);
              router.push(`/room/${code}/vote`);
              return;
            }
            
            await loadRoundData(updatedRoom.id, updatedRoom.current_round);
          } else if (updatedRoom.status === 'finished') {
            // All rounds finished, redirect to result
            router.push(`/room/${code}/result`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, code, router, isHost]);

  // Fallback: Poll for room updates every 2 seconds to ensure we catch round changes
  useEffect(() => {
    if (!room || !code) return;

    const pollRoomStatus = async () => {
      try {
        const updatedRoom = await getRoomByCode(code);
        if (updatedRoom && updatedRoom.current_round) {
          // If room has moved to next round
          if (currentRound && updatedRoom.current_round > currentRound.round_number) {
            console.log('[Discussion] Polling detected new round. Redirecting to vote.');
            router.push(`/room/${code}/vote`);
          } else if (updatedRoom.current_round !== room.current_round) {
             // Sync local room state if changed but not necessarily a new round (e.g. status change)
             setRoom(updatedRoom);
          }
        } else if (updatedRoom?.status === 'finished') {
           router.push(`/room/${code}/result`);
        }
      } catch (err) {
        console.error('Room polling error:', err);
      }
    };

    const intervalId = setInterval(pollRoomStatus, 2000);
    return () => clearInterval(intervalId);
  }, [room, currentRound, code, router]);

  // Subscribe to families (to catch newly added families)
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`families:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'families',
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          const familiesData = await getFamiliesByRoom(room.id);
          setFamilies(familiesData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  // Subscribe to broadcast for roulette
  useEffect(() => {
    if (!room) return;

    const channel = supabase.channel(`room:${room.id}`);

    channel
      .on('broadcast', { event: 'spin-roulette' }, (payload) => {
        console.log('Received spin-roulette:', payload);
        // Start spinning if we are in the correct round
        // We check roundId but strictly we might want to just spin if the modal is open or expected
        if (currentRound && payload.payload.roundId === currentRound.id) {
           setShowRoulette(true);
           setRouletteTargetWinner(payload.payload.winner);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, currentRound]);

  // Check for tie on load to show modal (waiting state)
  useEffect(() => {
      if (currentRound?.tie_photos && currentRound.tie_photos.length > 0 && !currentRound.winning_photo_id) {
          setShowRoulette(true);
      } else {
          // If winner exists or no tie, close modal ONLY IF we are not currently spinning/showing result
          // This prevents closing the modal mid-spin if the DB update arrives early
          if (!rouletteTargetWinner) {
             setShowRoulette(false);
          }
      }
  }, [currentRound, rouletteTargetWinner]);

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
          // Add small delay to ensure database consistency
          setTimeout(async () => {
            const votesData = await getVotesByRound(currentRound.id);
            setVotes(votesData);
          }, 200);
        }
      )
      .subscribe();

    // Load initial votes with retry mechanism
    const loadVotes = async (retryCount = 0) => {
      try {
        const votesData = await getVotesByRound(currentRound.id);
        setVotes(votesData);
        
        // If we just navigated here and votes seem incomplete, retry once
        if (retryCount === 0 && room && families.length > 0) {
          const expectedVoteCount = families.length;
          if (votesData.length < expectedVoteCount) {
            setTimeout(() => loadVotes(1), 500);
          }
        }
      } catch (err) {
        console.error('Votes 로드 실패:', err);
        if (retryCount === 0) {
          setTimeout(() => loadVotes(1), 500);
        }
      }
    };
    
    // Small delay on initial load to ensure data consistency
    setTimeout(() => loadVotes(), 300);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRound, room, families.length]);

  // Check for unanimous vote and trigger confetti
  useEffect(() => {
    if (votes.length >= 3 && families.length >= 3 && currentRound) {
      if (celebratedRoundsRef.current.has(currentRound.id)) {
        return;
      }

      try {
        const { winningPhotoId, isTie } = calculateWinningPhoto(votes);
        const isUnanimous = !isTie && winningPhotoId && votes.every(v => v.photo_id === winningPhotoId);
        
        if (isUnanimous) {
          celebratedRoundsRef.current.add(currentRound.id);
          // Fire fireworks/confetti
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

          // Play cheering sound
          try {
            const audio = new Audio('/sounds/cheering.mp3');
            audio.volume = 0.5;
            audio.play().catch(e => console.log('Audio play failed', e));
          } catch (e) {
            console.log('Audio error', e);
          }

          const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

          const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
          }, 250);

          return () => clearInterval(interval);
        }
      } catch (e) {
        // Ignore errors during calculation
      }
    }
  }, [votes, families, currentRound]);

  const loadRoundData = async (roomId: string, roundNumber: number) => {
    try {
      const round = await getRoundByRoomAndNumber(roomId, roundNumber);
      if (round) {
        setCurrentRound(round);
        lastRoundNumberRef.current = round.round_number;
        const allPhotos = await getPhotosByRoom(roomId);
        const roundPhotos = allPhotos.filter((p) =>
          round.photo_ids.includes(p.id)
        );
        setPhotos(roundPhotos);
        
        // Reload families to ensure all families are included
        const familiesData = await getFamiliesByRoom(roomId);
        setFamilies(familiesData);
        
        // Reload votes to ensure all votes are included
        const votesData = await getVotesByRound(round.id);
        setVotes(votesData);

        const allRounds = await getRoundsByRoom(roomId);
        const possibleNext = round.round_number + 1;
        const hasNext = allRounds.some((r) => r.round_number === possibleNext);
        setNextRoundNumber(hasNext ? possibleNext : null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 로드 실패');
    }
  };

  const handleEndRound = async () => {
    if (!room || !currentRound) return;

    if (currentRound.tie_photos && currentRound.tie_photos.length > 0) {
      setError('동점입니다. 룰렛으로 승자를 결정해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let winningPhotoId = currentRound.winning_photo_id;
      let isTie = false;
      let tiePhotos: string[] = [];

      if (!winningPhotoId) {
        const result = calculateWinningPhoto(votes);
        winningPhotoId = result.winningPhotoId;
        isTie = result.isTie;
        tiePhotos = result.tiePhotos;
      }

      if (isTie || !winningPhotoId) {
        await updateRound(currentRound.id, {
          winning_photo_id: null,
          tie_photos: tiePhotos,
        });
        setCurrentRound((prev) =>
          prev ? { ...prev, winning_photo_id: null, tie_photos: tiePhotos } : prev
        );
        setError('동점입니다! 룰렛으로 승자를 결정해 주세요.');
        return;
      }

      if (!currentRound.winning_photo_id) {
        await updateRound(currentRound.id, {
          winning_photo_id,
          tie_photos: null,
        });
      }

      // Move to next round or finish
      const nextRound = currentRound.round_number + 1;
      const allRounds = await getRoundsByRoom(room.id);
      const hasNextRound = allRounds.some((r) => r.round_number === nextRound);

      if (hasNextRound) {
        await updateRoom(room.id, {
          status: 'lobby',
          current_round: currentRound.round_number,
        });
        const updatedRoom = await getRoomByCode(room.code);
        if (updatedRoom) setRoom(updatedRoom);
      } else {
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

      router.push(`/room/${code}/vote`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '���� ���� ����');
    } finally {
      setLoading(false);
    }
  };

  if (!room || !currentRound) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  // Get vote summary - each family's selected photo
  // Ensure we show all 3 families even if they haven't been created yet
  const allFamilyLabels: Array<'신랑네' | '신부네' | '우리부부'> = ['신랑네', '신부네', '우리부부'];
  
  const voteSummary = allFamilyLabels.map((label) => {
    const family = families.find((f) => f.label === label);
    if (!family) {
      // Family not created yet, return placeholder
      return { 
        family: { id: '', label, room_id: room?.id || '', created_at: '' } as Family, 
        vote: null, 
        photo: null 
      };
    }
    const vote = votes.find((v) => v.family_id === family.id);
    const photo = vote ? photos.find((p) => p.id === vote.photo_id) : null;
    return { family, vote, photo };
  });

  const allVoted = families.length >= 3 && voteSummary.every((vs) => vs.vote);
  const tiePending = Boolean(currentRound.tie_photos && currentRound.tie_photos.length > 0);

  return (
    <div className="min-h-screen p-4 bg-beige">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold mb-2">선택 결과</h1>
          <p className="text-xl text-gray-700">
            라운드 {currentRound.round_number}
          </p>
          <p className="text-lg text-gray-600 mt-2">
            각 가족이 선택한 사진을 확인하고 이야기를 나눠보세요
          </p>
          
          {/* Round Result Status Message */}
          {voteSummary.every(v => v.vote) && (() => {
            try {
              // Only calculate if we have votes from all families (or at least some votes)
              if (votes.length === 0) return null;
              
              const { winningPhotoId, isTie } = calculateWinningPhoto(votes);
              
              if (isTie) {
                return (
                  <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg inline-block animate-bounce">
                    <p className="font-bold text-lg">⚠️ 1:1:1 동점입니다!</p>
                    <p className="text-sm">호스트가 룰렛을 돌려 승자를 정하면 이 화면이 자동으로 업데이트됩니다.</p>
                  </div>
                );
              } else if (winningPhotoId) {
                 const isUnanimous = votes.every(v => v.photo_id === winningPhotoId);
                 
                 if (isUnanimous) {
                   return (
                     <div className="mt-4 p-6 bg-gradient-to-r from-pink-100 via-red-100 to-pink-100 border-4 border-pink-300 text-pink-800 rounded-2xl inline-block shadow-xl transform transition hover:scale-105">
                       <p className="font-black text-3xl mb-2">🎊 만장일치! 🎊</p>
                       <p className="text-xl font-bold">모든 가족의 마음이 하나로 통했네요! ❤️</p>
                       <p className="text-md mt-2 text-pink-600">화기애애한 분위기 속에서 다음 라운드로 Go!</p>
                     </div>
                   );
                 }

                 // Find which family voted for the winner (optional, or just show photo)
                 return (
                  <div className="mt-4 p-3 bg-blue-100 text-blue-800 rounded-lg inline-block">
                    <p className="font-bold text-lg">🎉 승자가 결정되었습니다!</p>
                    <p className="text-sm">다수결로 선정된 사진이 있습니다.</p>
                  </div>
                );
              }
            } catch (e) {
              return null;
            }
          })()}
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Family Selections Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {voteSummary.map(({ family, photo }) => (
            <div
              key={family.id}
              className="bg-white rounded-lg p-6 shadow-lg"
            >
              <h3 className="text-xl font-bold text-center mb-4 text-gold">
                {family.label}
              </h3>
              {photo ? (
                <div className="space-y-3">
                  <img
                    src={photo.url}
                    alt={`${family.label} 선택`}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      사진 {photos.findIndex((p) => p.id === photo.id) + 1}번
                    </p>
                    <span className="inline-block mt-2 px-3 py-1 bg-gold text-white rounded-full text-sm font-semibold">
                      선택 완료 ✓
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                  <p className="text-gray-500">선택 대기 중...</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {tiePending && (
          <div className="bg-pink-50 border-2 border-pink-200 rounded-xl p-6 shadow-inner text-center space-y-2">
            <p className="text-xl font-bold text-pink-700">⚖️ 1:1:1 동점입니다!</p>
            <p className="text-sm text-pink-600">
              호스트 페이지에서 룰렛을 돌려 행운의 가족을 결정할 때까지 잠시만 기다려 주세요.
            </p>
            <p className="text-sm text-pink-500">
              룰렛 결과가 확정되면 이 화면이 자동으로 업데이트됩니다.
            </p>
          </div>
        )}

        {/* Host Controls */}
        {isHost && room.status === 'in_progress' && allVoted && (
          <div className="text-center bg-white rounded-lg p-6 shadow-lg">
            <p className="text-lg text-gray-700 mb-4">
              모든 가족이 선택을 완료했습니다.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              이야기를 나눈 뒤 라운드를 종료해 주세요.
            </p>
            <button
              onClick={handleEndRound}
              disabled={loading}
              className="px-8 py-4 bg-gold text-white rounded-lg text-xl font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {loading ? '처리 중...' : '라운드 종료'}
            </button>
          </div>
        )}

        {isHost && room.status === 'lobby' && nextRoundNumber && (
          <div className="text-center bg-white rounded-lg p-6 shadow-lg">
            <p className="text-lg text-gray-700 mb-4">
              토론이 끝나면 다음 라운드를 시작하세요.
            </p>
            <p className="text-sm text-gray-600 mb-6">
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
        )}

        {/* Waiting message for non-host users */}
        {!isHost && allVoted && (
          <div className="text-center bg-white rounded-lg p-6 shadow-lg">
            <p className="text-lg text-gray-700">
              모든 가족이 선택을 완료했습니다.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              호스트가 다음 라운드로 진행할 때까지 기다려주세요...
            </p>
          </div>
        )}

        {/* Waiting message when not all voted */}
        {!allVoted && (
          <div className="text-center bg-white rounded-lg p-6 shadow-lg">
            <p className="text-lg text-gray-700">
              모든 가족이 선택할 때까지 기다리는 중...
            </p>
            <div className="mt-4 space-y-2">
              {voteSummary.map(({ family, vote }) => (
                <div
                  key={family.id}
                  className={`p-2 rounded ${
                    vote ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {family.label}: {vote ? '선택 완료 ✓' : '대기 중...'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roulette Modal */}
        {showRoulette && currentRound && (
          <RouletteModal
            roundNumber={currentRound.round_number}
            onClose={() => setShowRoulette(false)}
            onComplete={() => {
              setShowRoulette(false);
              setRouletteTargetWinner(null);
            }}
            targetWinner={rouletteTargetWinner}
          />
        )}
      </div>
    </div>
  );
}

