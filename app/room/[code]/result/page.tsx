'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getRoomByCode, getRoundsByRoom, getPhotosByRoom } from '@/lib/utils';
import type { Room, Round, Photo } from '@/lib/types';

export default function ResultPage() {
  const params = useParams();
  const code = params.code as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [winningPhotos, setWinningPhotos] = useState<Photo[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;

    const loadData = async () => {
      try {
        const roomData = await getRoomByCode(code);
        if (roomData) {
          setRoom(roomData);
          const roundsData = await getRoundsByRoom(roomData.id);
          setRounds(roundsData);
          const photosData = await getPhotosByRoom(roomData.id);
          setAllPhotos(photosData);

          // Get winning photos
          const winners = roundsData
            .filter((r) => r.winning_photo_id)
            .map((r) => {
              const photo = photosData.find((p) => p.id === r.winning_photo_id);
              return photo;
            })
            .filter((p): p is Photo => p !== undefined);

          setWinningPhotos(winners);
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [code]);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % winningPhotos.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + winningPhotos.length) % winningPhotos.length
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (winningPhotos.length === 0) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gold">결과</h1>
          <p className="text-gray-600">선택된 사진이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-beige">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gold mb-2">최종 결과</h1>
          <p className="text-xl text-gray-700">
            가족들이 선택한 {winningPhotos.length}장의 사진
          </p>
        </div>

        {/* Fullscreen Slideshow */}
        {isFullscreen && (
          <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 text-white text-2xl font-bold z-10"
            >
              ✕
            </button>
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={winningPhotos[currentSlide].url}
                alt={`Winner ${currentSlide + 1}`}
                className="max-w-full max-h-full object-contain"
              />
              <button
                onClick={handlePrevSlide}
                className="absolute left-4 text-white text-4xl font-bold hover:opacity-70"
              >
                ‹
              </button>
              <button
                onClick={handleNextSlide}
                className="absolute right-4 text-white text-4xl font-bold hover:opacity-70"
              >
                ›
              </button>
            </div>
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
              {currentSlide + 1} / {winningPhotos.length}
            </div>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {winningPhotos.map((photo, index) => (
            <div
              key={photo.id}
              className="bg-white rounded-lg overflow-hidden shadow-lg cursor-pointer hover:scale-105 transition"
              onClick={() => {
                setCurrentSlide(index);
                setIsFullscreen(true);
              }}
            >
              <img
                src={photo.url}
                alt={`Winner ${index + 1}`}
                className="w-full h-48 object-cover"
              />
              <div className="p-2 text-center">
                <p className="text-sm font-semibold text-gold">
                  라운드 {rounds.find((r) => r.winning_photo_id === photo.id)?.round_number}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Slideshow Button */}
        <div className="text-center">
          <button
            onClick={() => {
              setCurrentSlide(0);
              setIsFullscreen(true);
            }}
            className="px-8 py-4 bg-gold text-white rounded-lg text-xl font-semibold hover:bg-opacity-90 transition"
          >
            전체 화면 슬라이드쇼 보기
          </button>
        </div>

        {/* Round Summary */}
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4">라운드별 결과</h2>
          <div className="space-y-3">
            {rounds.map((round) => {
              const winningPhoto = allPhotos.find(
                (p) => p.id === round.winning_photo_id
              );
              return (
                <div
                  key={round.id}
                  className="flex items-center justify-between p-3 bg-beige rounded-lg"
                >
                  <span className="font-semibold">라운드 {round.round_number}</span>
                  {winningPhoto ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={winningPhoto.url}
                        alt="Winner"
                        className="w-16 h-16 object-cover rounded"
                      />
                      <span className="text-gold font-semibold">선택됨 ✓</span>
                    </div>
                  ) : (
                    <span className="text-gray-500">미완료</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

