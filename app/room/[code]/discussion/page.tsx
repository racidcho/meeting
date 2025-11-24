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
} from '@/lib/utils';
import type { Room, Round, Photo, Family, Vote } from '@/lib/types';

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
          setRoom(updatedRoom);

          if (updatedRoom.current_round) {
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
  }, [room, code, router]);

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
        
        // Reload families to ensure all families are included
        const familiesData = await getFamiliesByRoom(roomId);
        setFamilies(familiesData);
        
        // Reload votes to ensure all votes are included
        const votesData = await getVotesByRound(round.id);
        setVotes(votesData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 로드 실패');
    }
  };

  const handleEndRound = async () => {
    if (!room || !currentRound) return;

    try {
      setLoading(true);
      setError(null);

      // Calculate winning photo (most votes)
      const voteCounts: Record<string, number> = {};
      votes.forEach((vote) => {
        voteCounts[vote.photo_id] = (voteCounts[vote.photo_id] || 0) + 1;
      });

      const winningPhotoId = Object.entries(voteCounts).reduce((a, b) =>
        voteCounts[a[0]] > voteCounts[b[0]] ? a : b
      )[0];

      // Update round with winning photo
      await updateRound(currentRound.id, {
        winning_photo_id: winningPhotoId,
      });

      // Move to next round or finish
      const nextRound = currentRound.round_number + 1;
      const allRounds = await getRoundsByRoom(room.id);
      const hasNextRound = allRounds.some((r) => r.round_number === nextRound);

      if (hasNextRound) {
        await updateRoom(room.id, {
          current_round: nextRound,
          status: 'in_progress',
        });
        await loadRoundData(room.id, nextRound);
        const updatedRoom = await getRoomByCode(room.code);
        if (updatedRoom) setRoom(updatedRoom);
        // Redirect to vote page for next round
        router.push(`/room/${code}/vote`);
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

        {/* Host Controls */}
        {isHost && allVoted && (
          <div className="text-center bg-white rounded-lg p-6 shadow-lg">
            <p className="text-lg text-gray-700 mb-4">
              모든 가족이 선택을 완료했습니다.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              이야기를 나눈 후, 다음 라운드로 진행하세요.
            </p>
            <button
              onClick={handleEndRound}
              disabled={loading}
              className="px-8 py-4 bg-gold text-white rounded-lg text-xl font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {loading ? '처리 중...' : '다음 라운드로 진행'}
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
      </div>
    </div>
  );
}

