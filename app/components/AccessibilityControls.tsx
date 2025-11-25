'use client';

import { useState, useEffect } from 'react';

export default function AccessibilityControls() {
  const [fontSize, setFontSize] = useState(100);

  useEffect(() => {
    // 기본 1rem = 16px 기준으로 % 조정
    document.documentElement.style.fontSize = `${fontSize}%`;
  }, [fontSize]);

  const increaseFont = () => setFontSize((prev) => Math.min(prev + 25, 150)); // 최대 150%
  const decreaseFont = () => setFontSize((prev) => Math.max(prev - 10, 90));  // 최소 90%
  const resetFont = () => setFontSize(100);

  return (
    <div className="fixed bottom-4 left-4 z-50 flex gap-2 bg-white p-2 rounded-full shadow-lg border-2 border-gold">
      <button
        onClick={decreaseFont}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-lg font-bold text-gray-700 transition"
        aria-label="글자 작게"
      >
        가
      </button>
      <button
        onClick={resetFont}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700 transition"
        aria-label="기본 크기"
      >
        ↺
      </button>
      <button
        onClick={increaseFont}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gold text-white hover:bg-opacity-90 text-xl font-bold transition"
        aria-label="글자 크게"
      >
        가+
      </button>
    </div>
  );
}


