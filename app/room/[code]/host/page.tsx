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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 로드 실패');
    }
  };

  const handleEndRound = async () => {
    if (!room || !currentRound) return;
    
    // Check if all families have voted
    if (families.length > 0 && votes.length < families.length) {
      setError('모든 가족이 투표할 때까지 기다려주세요.');
      return;
    }

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

  const allVoted = families.length > 0 && voteSummary.every((vs) => vs.vote);

  return (
    <div className="min-h-screen p-4 bg-beige">
      <div className="max-w-6xl mx-auto space-y-6">
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

        {/* End Round Button */}
        {allVoted && (
          <div className="text-center">
            <button
              onClick={handleEndRound}
              disabled={loading}
              className="px-8 py-4 bg-gold text-white rounded-lg text-xl font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {loading ? '처리 중...' : '라운드 종료'}
            </button>
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

