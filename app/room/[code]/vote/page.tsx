'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getRoomByCode,
  getRoundByRoomAndNumber,
  getPhotosByRoom,
  getOrCreateFamily,
  createVote,
  getVoteByFamilyAndRound,
} from '@/lib/utils';
import type { Room, Round, Photo, Family, Vote } from '@/lib/types';

type FamilyLabel = '신랑네' | '신부네' | '우리부부';

export default function VotePage() {
  const params = useParams();
  const code = params.code as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [familySelection, setFamilySelection] = useState<FamilyLabel | null>(null);

  // Load room data
  useEffect(() => {
    if (!code) return;

    const loadRoom = async () => {
      try {
        const roomData = await getRoomByCode(code);
        if (roomData) {
          setRoom(roomData);
        } else {
          setError('방을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '방 로드 실패');
      }
    };

    loadRoom();
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

          // Load current round data when round changes
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

  // Load round data when current_round changes
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

        // Check if family already voted
        if (family) {
          const existingVote = await getVoteByFamilyAndRound(
            family.id,
            round.id
          );
          if (existingVote) {
            setSelectedPhotoId(existingVote.photo_id);
            setVoted(true);
          } else {
            setVoted(false);
            setSelectedPhotoId(null);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '라운드 로드 실패');
    }
  };

  useEffect(() => {
    if (room && room.current_round && family) {
      loadRoundData(room.id, room.current_round);
    }
  }, [room?.current_round, family]);

  const handleSelectFamily = async (label: FamilyLabel) => {
    if (!room) return;

    try {
      setLoading(true);
      setError(null);
      const familyData = await getOrCreateFamily(room.id, label);
      setFamily(familyData);
      setFamilySelection(label);

      // Load round if already in progress
      if (room.current_round) {
        await loadRoundData(room.id, room.current_round);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '가족 선택 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (photoId: string) => {
    if (!room || !currentRound || !family || voted) return;

    try {
      setLoading(true);
      setError(null);
      await createVote({
        room_id: room.id,
        round_id: currentRound.id,
        family_id: family.id,
        photo_id: photoId,
      });
      setSelectedPhotoId(photoId);
      setVoted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '투표 실패');
    } finally {
      setLoading(false);
    }
  };

  // Family selection screen
  if (!family && !familySelection) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-2xl font-bold text-center text-gold mb-4">
            가족 선택
          </h1>
          <div className="space-y-3">
            {(['신랑네', '신부네', '우리부부'] as FamilyLabel[]).map((label) => (
              <button
                key={label}
                onClick={() => handleSelectFamily(label)}
                disabled={loading}
                className="w-full px-6 py-4 bg-beige text-gray-800 rounded-lg text-lg font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting screen
  if (!room || room.status === 'lobby' || !room.current_round) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gold">
            {family?.label || familySelection}
          </h1>
          <p className="text-gray-600">라운드가 시작되기를 기다리는 중...</p>
        </div>
      </div>
    );
  }

  // Voting screen
  if (!currentRound || photos.length === 0) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">라운드 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gold mb-2">
            {family?.label}
          </h1>
          <p className="text-lg text-gray-700">
            라운드 {currentRound.round_number}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {voted && (
          <div className="p-4 bg-green-100 text-green-700 rounded-lg text-center font-semibold">
            선택 완료 ✅
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {photos.map((photo, index) => {
            const isSelected = selectedPhotoId === photo.id;
            return (
              <button
                key={photo.id}
                onClick={() => !voted && handleVote(photo.id)}
                disabled={voted || loading}
                className={`relative p-2 rounded-lg border-2 transition ${
                  isSelected
                    ? 'border-gold bg-gold bg-opacity-10'
                    : 'border-gray-200 hover:border-gold'
                } ${voted ? 'opacity-60' : ''}`}
              >
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-64 object-cover rounded"
                />
                {isSelected && (
                  <div className="absolute top-4 right-4 bg-gold text-white px-3 py-1 rounded-full font-semibold">
                    선택됨 ✓
                  </div>
                )}
                <div className="mt-2 text-center font-semibold">
                  사진 {index + 1}번
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

