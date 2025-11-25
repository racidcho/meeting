'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  getRoomByCode,
  getRoundByRoomAndNumber,
  getPhotosByRoom,
  getOrCreateFamily,
  createVote,
  getVoteByFamilyAndRound,
  getFamiliesByRoom,
  getVotesByRound,
} from '@/lib/utils';
import type { Room, Round, Photo, Family, Vote } from '@/lib/types';

type FamilyLabel = '신랑네' | '신부네' | '우리부부';

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
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
  const [allFamiliesVoted, setAllFamiliesVoted] = useState(false);
  const [selectedFamilies, setSelectedFamilies] = useState<Family[]>([]);
  const [navigatedToDiscussion, setNavigatedToDiscussion] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<Photo | null>(null);
  const lastRoundNumberRef = useRef<number | null>(null);

  // Load room data
  useEffect(() => {
    if (!code) return;

    const loadRoom = async () => {
      try {
        const roomData = await getRoomByCode(code);
        if (roomData) {
          setRoom(roomData);
          // Initialize last round number
          if (roomData.current_round) {
            lastRoundNumberRef.current = roomData.current_round;
          }
        } else {
          setError('방을 찾을 수 없습니다.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '방 로드 실패');
      }
    };

    loadRoom();
  }, [code]);

  // Load selected families when room is loaded
  useEffect(() => {
    if (!room) return;

    const loadSelectedFamilies = async () => {
      try {
        const families = await getFamiliesByRoom(room.id);
        setSelectedFamilies(families);
      } catch (err) {
        console.error('가족 목록 로드 실패:', err);
      }
    };

    loadSelectedFamilies();
  }, [room]);

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

          // Load current round data when round changes
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

  // Subscribe to families changes to update selected families in real-time
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
        async (payload) => {
          console.log('가족 변경 이벤트 수신:', payload);
          try {
            const families = await getFamiliesByRoom(room.id);
            console.log('업데이트된 가족 목록:', families);
            setSelectedFamilies(families);
          } catch (err) {
            console.error('가족 목록 업데이트 실패:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('가족 구독 상태:', status);
        if (status === 'SUBSCRIBED') {
          console.log('가족 변경 구독 성공');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('가족 구독 오류 - 폴링으로 전환');
        }
      });

    // Fallback: 주기적으로 가족 목록 확인 (Realtime이 작동하지 않을 경우 대비)
    const pollInterval = setInterval(async () => {
      try {
        const families = await getFamiliesByRoom(room.id);
        setSelectedFamilies((prev) => {
          // 변경사항이 있는지 확인
          if (prev.length !== families.length || 
              prev.some((p, i) => p.id !== families[i]?.id)) {
            console.log('폴링으로 가족 목록 업데이트:', families);
            return families;
          }
          return prev;
        });
      } catch (err) {
        console.error('가족 목록 폴링 실패:', err);
      }
    }, 2000); // 2초마다 확인

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [room]);

  // Check if all families voted
  const checkAllFamiliesVoted = async (roomId: string, roundId: string, hasVoted?: boolean) => {
    try {
      const families = await getFamiliesByRoom(roomId);
      const votes = await getVotesByRound(roundId);
      const allVoted = families.length > 0 && families.every((f) =>
        votes.some((v) => v.family_id === f.id)
      );
      
      // Use the passed hasVoted parameter if provided, otherwise use state
      const myVoted = hasVoted !== undefined ? hasVoted : voted;
      
      console.log('[Vote] Check all voted:', {
        familiesCount: families.length,
        votesCount: votes.length,
        allVoted,
        myVoted,
        navigatedToDiscussion
      });
      
      setAllFamiliesVoted(allVoted);
      
      // If all families voted and I have voted too, go to discussion page
      if (allVoted && myVoted && !navigatedToDiscussion) {
        console.log('[Vote] All families voted, navigating to discussion');
        setNavigatedToDiscussion(true);
        // Small delay to show the "선택 완료" message
        setTimeout(() => {
          router.push(`/room/${code}/discussion`);
        }, 1500);
      }
    } catch (err) {
      console.error('가족 투표 확인 실패:', err);
    }
  };

  // Load round data when current_round changes
  const loadRoundData = async (roomId: string, roundNumber: number) => {
    try {
      const previousRoundNumber = lastRoundNumberRef.current;
      const isNewRound = previousRoundNumber !== null && roundNumber > previousRoundNumber;
      
      const round = await getRoundByRoomAndNumber(roomId, roundNumber);
      if (round) {
        setCurrentRound(round);
        const allPhotos = await getPhotosByRoom(roomId);
        const roundPhotos = allPhotos.filter((p) =>
          round.photo_ids.includes(p.id)
        );
        setPhotos(roundPhotos);

        // If this is a new round, reset voting state
        if (isNewRound) {
          setVoted(false);
          setSelectedPhotoId(null);
          setAllFamiliesVoted(false);
          setNavigatedToDiscussion(false);
        }

        // Check if family already voted
        if (family) {
          const existingVote = await getVoteByFamilyAndRound(
            family.id,
            round.id
          );
          if (existingVote) {
            setSelectedPhotoId(existingVote.photo_id);
            setVoted(true);
          } else if (!isNewRound) {
            // Only reset if not a new round (to preserve state during same round reloads)
            setVoted(false);
            setSelectedPhotoId(null);
          }
        }

        // Update last round number
        lastRoundNumberRef.current = roundNumber;

        // Check if all families voted
        await checkAllFamiliesVoted(roomId, round.id);
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

  // Subscribe to votes to check when all families voted
  useEffect(() => {
    if (!currentRound || !room || !family) return;

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
          console.log('[Vote] Realtime: vote change detected');
          await checkAllFamiliesVoted(room.id, currentRound.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRound?.id, room?.id, family?.id, voted, navigatedToDiscussion]);


  const handleSelectFamily = async (
    label: FamilyLabel,
    options?: { skipExistingCheck?: boolean }
  ) => {
    if (!room) return;

    // Check if family is already selected
    const isAlreadySelected = selectedFamilies.some((f) => f.label === label);
    if (isAlreadySelected && !options?.skipExistingCheck) {
      setError(`${label}��(��) �̹� ���õǾ����ϴ�. �ٸ� ������ �������ּ���.`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const familyData = await getOrCreateFamily(room.id, label);
      setFamily(familyData);
      setFamilySelection(label);
      if (typeof window !== 'undefined' && code) {
        sessionStorage.setItem(`familySelection_${code}`, label);
      }
      
      // Update selected families list
      setSelectedFamilies((prev) => {
        if (prev.some((f) => f.id === familyData.id)) {
          return prev;
        }
        return [...prev, familyData];
      });

      // Load round if already in progress
      if (room.current_round) {
        await loadRoundData(room.id, room.current_round);
      }
    } catch (err) {
      // Check if error is due to unique constraint violation
      if ((err instanceof Error && err.message.includes('duplicate')) || (err instanceof Error && err.message.includes('UNIQUE'))) {
        setError(`${label}��(��) �̹� ���õǾ����ϴ�. �ٸ� ������ �������ּ���.`);
        // Reload families to get updated list
        try {
          const families = await getFamiliesByRoom(room.id);
          setSelectedFamilies(families);
        } catch (reloadErr) {
          console.error('���� ��� ��ε� ����:', reloadErr);
        }
      } else {
        setError(err instanceof Error ? err.message : '���� ���� ����');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!room || family || !code) return;

    if (typeof window === 'undefined') return;

    const storedLabel = sessionStorage.getItem(`familySelection_${code}`);
    if (
      storedLabel &&
      ['신랑네', '신부네', '우리부부'].includes(storedLabel)
    ) {
      handleSelectFamily(storedLabel as FamilyLabel, {
        skipExistingCheck: true,
      });
    }
  }, [room, family, code, selectedFamilies]);

  useEffect(() => {
    setNavigatedToDiscussion(false);
  }, [currentRound?.id, family?.id]);



  const handleVote = async (photoId: string) => {
    if (!room || !currentRound || !family || voted) return;

    try {
      setLoading(true);
      setError(null);
      
      // Play pop sound
      try {
        const audio = new Audio('/sounds/pop.mp3');
        audio.play().catch(() => {});
      } catch (e) {}

      await createVote({
        room_id: room.id,
        round_id: currentRound.id,
        family_id: family.id,
        photo_id: photoId,
      });
      setSelectedPhotoId(photoId);
      setVoted(true);
      
      // Pass true to indicate this user has voted (state update is async)
      await checkAllFamiliesVoted(room.id, currentRound.id, true);
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
            {(['신랑네', '신부네', '우리부부'] as FamilyLabel[]).map((label) => {
              const isSelected = selectedFamilies.some((f) => f.label === label);
              return (
                <button
                  key={label}
                  onClick={() => handleSelectFamily(label)}
                  disabled={loading || isSelected}
                  className={`w-full px-6 py-4 rounded-lg text-lg font-semibold transition ${
                    isSelected
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-beige text-gray-800 hover:bg-opacity-90'
                  } ${loading ? 'opacity-50' : ''}`}
                >
                  {label}
                  {isSelected && (
                    <span className="ml-2 text-sm">(이미 선택됨)</span>
                  )}
                </button>
              );
            })}
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
  if (
    !room ||
    room.status === 'lobby' ||
    !room.current_round
  ) {
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
              <div
                key={photo.id}
                className={`relative p-2 rounded-lg border-2 transition bg-white ${
                  isSelected
                    ? 'border-gold bg-gold bg-opacity-10'
                    : 'border-gray-200'
                } ${voted ? 'opacity-60' : ''}`}
              >
                <div 
                  className="relative cursor-pointer group"
                  onClick={() => setZoomedPhoto(photo)}
                >
                  <img
                    src={photo.url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-64 object-cover rounded"
                  />
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded flex items-center justify-center">
                    <span className="text-white font-bold opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 px-3 py-1 rounded-full">
                      크게 보기
                    </span>
                  </div>
                </div>
                
                {isSelected && (
                  <div className="absolute top-4 left-4 bg-gold text-white px-3 py-1 rounded-full font-semibold z-10">
                    선택됨 ✓
                  </div>
                )}
                
                <div className="mt-3">
                  <div className="text-center font-semibold mb-2 text-lg">
                    사진 {index + 1}번
                  </div>
                  <button
                    onClick={() => !voted && handleVote(photo.id)}
                    disabled={voted || loading}
                    className={`w-full py-4 rounded-lg text-xl font-bold text-white transition ${
                      isSelected 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gold hover:bg-opacity-90'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSelected ? '선택 완료' : '이 사진 선택하기'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Image Zoom Modal */}
        {zoomedPhoto && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col items-center justify-center p-4">
            <button
              onClick={() => setZoomedPhoto(null)}
              className="absolute top-4 right-4 text-white p-2 rounded-full bg-gray-800 hover:bg-gray-700 z-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="flex-1 flex items-center justify-center w-full max-h-[80vh]">
              <img
                src={zoomedPhoto.url}
                alt="Zoomed"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
            
            <div className="mt-6 w-full max-w-md">
              <button
                onClick={() => {
                  if (!voted) {
                    handleVote(zoomedPhoto.id);
                    setZoomedPhoto(null);
                  }
                }}
                disabled={voted || loading}
                className={`w-full py-6 rounded-xl text-2xl font-bold text-white shadow-lg transition ${
                  selectedPhotoId === zoomedPhoto.id
                    ? 'bg-green-600'
                    : 'bg-gold hover:bg-yellow-600'
                } disabled:opacity-50`}
              >
                {selectedPhotoId === zoomedPhoto.id ? '이미 선택한 사진입니다' : '이 사진으로 결정하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

