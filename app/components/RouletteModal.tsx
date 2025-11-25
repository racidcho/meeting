'use client';

import { useState, useEffect, useRef } from 'react';
import { FamilyLabel } from '@/lib/types';

interface RouletteModalProps {
  onClose: () => void;
  onComplete: () => void;
  roundNumber: number;
  targetWinner: FamilyLabel | null;
  onRequestSpin?: () => void;
}

export default function RouletteModal({
  onClose,
  onComplete,
  roundNumber,
  targetWinner,
  onRequestSpin,
}: RouletteModalProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [displayedWinner, setDisplayedWinner] = useState<FamilyLabel | null>(null);
  const hasSpun = useRef(false);
  
  // Audio refs
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    spinAudioRef.current = new Audio('/sounds/spin.mp3');
    spinAudioRef.current.loop = true;
    winAudioRef.current = new Audio('/sounds/win.mp3');
    
    return () => {
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current = null;
      }
    };
  }, []);
  
  // 룰렛 섹션 설정 (3등분)
  const sections: { label: FamilyLabel; color: string; textColor: string }[] = [
    { label: '신랑네', color: '#EBF4FA', textColor: '#4A90E2' }, // 파스텔 블루
    { label: '신부네', color: '#FFF0F5', textColor: '#E2748B' }, // 파스텔 핑크
    { label: '우리부부', color: '#F0FFF4', textColor: '#66CDAA' }, // 파스텔 그린
  ];

  // targetWinner가 들어오면 스핀 시작
  useEffect(() => {
    if (targetWinner && !spinning && !hasSpun.current) {
      startSpin(targetWinner);
    }
  }, [targetWinner]);

  const startSpin = (winner: FamilyLabel) => {
    setSpinning(true);
    setDisplayedWinner(null);
    hasSpun.current = true;
    
    // Play spin sound
    if (spinAudioRef.current) {
      spinAudioRef.current.currentTime = 0;
      spinAudioRef.current.play().catch(e => console.log('Spin sound failed', e));
    }
    
    const winnerIndex = sections.findIndex(s => s.label === winner);
    if (winnerIndex === -1) {
      console.error('Invalid winner:', winner);
      return;
    }

    // Calculate rotation
    // 각 섹션은 120도. 
    // 섹션 0 (신랑네): 0-120도 (중심 60도)
    // 섹션 1 (신부네): 120-240도 (중심 180도)
    // 섹션 2 (우리부부): 240-360도 (중심 300도)
    // 룰렛이 시계방향으로 회전할 때, 포인터(상단 0도)에 해당 섹션이 오려면:
    // 목표 각도가 상단(0도)에 오도록 반대로 회전해야 함.
    // 회전 각도 = 360 - (섹션 중심 각도)
    // 예: 신부네(180도) -> 360 - 180 = 180도 회전하면 180도 지점이 0도(상단)에 옴.
    
    const sectionCenterAngle = winnerIndex * 120 + 60;
    const baseRotation = (360 - sectionCenterAngle + 360) % 360;
    
    // 5~10바퀴 추가 회전
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const totalRotation = rotation + (extraSpins * 360) + baseRotation;
    
    // 랜덤 오차 (섹션 내에서 약간 흔들리게, +/- 40도)
    const randomOffset = (Math.random() - 0.5) * 80; 
    
    setRotation(totalRotation + randomOffset);

    // 4초 후 결과 확인 (애니메이션 시간 + 여유)
    setTimeout(() => {
      setSpinning(false);
      
      // Stop spin sound and play win sound
      if (spinAudioRef.current) {
        spinAudioRef.current.pause();
        spinAudioRef.current.currentTime = 0;
      }
      if (winAudioRef.current) {
        winAudioRef.current.play().catch(e => console.log('Win sound failed', e));
      }
      
      setDisplayedWinner(winner);
      
      // 2초 뒤 완료 콜백
      setTimeout(() => {
        onComplete();
      }, 2000);
    }, 4000); // CSS duration 3000ms -> 4000ms wait to be safe
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center relative overflow-hidden">
        {/* 닫기 버튼은 결과가 나왔을 때만, 혹은 호스트만? 일단 닫기 가능하게 */}
        <button
          onClick={onClose}
          disabled={spinning}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-40"
          aria-label="닫기"
        >
          ✕
        </button>
        {/* 배경 장식 */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-200 via-pink-200 to-green-200" />
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">운명의 룰렛</h2>
        <p className="text-gray-600 mb-8">라운드 {roundNumber}의 주인공은?</p>

        {/* 룰렛 컨테이너 */}
        <div className="relative w-64 h-64 mb-8">
          {/* 화살표 (포인터) */}
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-gold filter drop-shadow-md" />
          </div>

          {/* 회전판 */}
          <div 
            className="w-full h-full rounded-full border-4 border-white shadow-lg overflow-hidden relative transition-transform duration-[3000ms] cubic-bezier(0.25, 0.1, 0.25, 1)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {sections.map((section, index) => (
              <div
                key={section.label}
                className="absolute w-full h-full top-0 left-0 origin-center flex justify-center pt-8"
                style={{
                  transform: `rotate(${index * 120}deg)`,
                  backgroundColor: section.color,
                  clipPath: 'polygon(0% 0%, 100% 0%, 50% 50%)', 
                }}
              />
            ))}
            
            {/* 텍스트 레이어 */}
             {sections.map((section, index) => (
              <div
                key={`text-${section.label}`}
                className="absolute w-full h-full top-0 left-0 origin-center"
                style={{
                  transform: `rotate(${index * 120}deg)`,
                }}
              >
                <div className="w-full h-1/2 flex justify-center pt-10">
                   <span 
                     className="font-bold text-lg transform -rotate-0"
                     style={{ color: section.textColor }}
                   >
                     {section.label}
                   </span>
                </div>
              </div>
            ))}
            
            {/* 3등분 선 (Conic Gradient) */}
            <div 
              className="absolute inset-0 rounded-full -z-10"
              style={{
                background: `conic-gradient(
                  ${sections[0].color} 0deg 120deg,
                  ${sections[1].color} 120deg 240deg,
                  ${sections[2].color} 240deg 360deg
                )`
              }}
            />
          </div>
          
          {/* 중앙 장식 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-md border-2 border-gray-100 z-10 flex items-center justify-center">
            <div className="w-2 h-2 bg-gold rounded-full" />
          </div>
        </div>

        {displayedWinner ? (
          <div className="text-center animate-bounce">
            <p className="text-xl text-gray-600">선택된 가족은</p>
            <p className="text-3xl font-bold text-gold mt-1">🎉 {displayedWinner} 🎉</p>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-center">
            {spinning ? (
               <span className="text-xl font-bold text-gold animate-pulse">두근두근...</span>
            ) : (
              onRequestSpin ? (
                <button
                  onClick={onRequestSpin}
                  className="px-8 py-3 rounded-full text-xl font-bold text-white shadow-lg transition transform hover:scale-105 bg-gradient-to-r from-gold to-yellow-600 hover:from-yellow-500 hover:to-yellow-700"
                >
                  돌리기!
                </button>
              ) : (
                <span className="text-lg text-gray-500 animate-pulse">호스트가 룰렛을 준비중입니다...</span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
