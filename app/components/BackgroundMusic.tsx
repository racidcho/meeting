'use client';

import { useState, useEffect, useRef } from 'react';

export default function BackgroundMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3); // 기본 볼륨 30%
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio instance only once
    const audio = new Audio('/sounds/bgm.mp3');
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    // Try to autoplay (might fail due to browser policy)
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          console.log('Autoplay prevented:', error);
          setIsPlaying(false);
        });
    }

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Update volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-lg border border-gold transition hover:bg-white">
      {!isPlaying && (
        <div className="absolute -top-12 right-0 bg-gold text-white text-xs px-3 py-1 rounded-full animate-bounce whitespace-nowrap">
          🎵 음악을 켜보세요!
        </div>
      )}
      <button
        onClick={togglePlay}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gold text-white hover:bg-opacity-90 transition"
        aria-label={isPlaying ? '음악 끄기' : '음악 켜기'}
      >
        {isPlaying ? '🔊' : '🔇'}
      </button>
      {isPlaying && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gold"
        />
      )}
    </div>
  );
}

