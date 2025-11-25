'use client';

import { useState, useRef } from 'react';
import type { FamilyLabel } from '@/lib/types';

interface RouletteProps {
  onComplete: (winner: FamilyLabel) => void;
  onClose: () => void;
}

const SECTORS: { label: FamilyLabel; color: string; textColor: string }[] = [
  { label: '신랑네', color: '#E6B17E', textColor: '#FFFFFF' },
  { label: '신부네', color: '#D4A373', textColor: '#FFFFFF' },
  { label: '우리부부', color: '#C29567', textColor: '#FFFFFF' },
];

export default function Roulette({ onComplete, onClose }: RouletteProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  const handleSpin = () => {
    if (isSpinning) return;

    setIsSpinning(true);
    
    // Random rotation: minimum 5 full spins (1800 deg) + random segment
    const extraSpins = 5 + Math.random() * 5; // 5 to 10 full spins
    const finalAngle = extraSpins * 360 + Math.random() * 360;
    
    setRotation(finalAngle);

    setTimeout(() => {
      // Determine winner
      // The wheel rotates clockwise. The value at the top (0 degrees) is determined by:
      // (360 - (finalAngle % 360)) % 360
      //
      // Sectors in CSS conic-gradient:
      // 0-120: Sector 0 (신랑네)
      // 120-240: Sector 1 (신부네)
      // 240-360: Sector 2 (우리부부)
      
      const normalizedAngle = (360 - (finalAngle % 360)) % 360;
      const sectorSize = 360 / SECTORS.length;
      const winningIndex = Math.floor(normalizedAngle / sectorSize);
      
      onComplete(SECTORS[winningIndex].label);
      setIsSpinning(false);
    }, 5000); // 5 seconds animation
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border-4 border-gold">
        <button 
          onClick={onClose}
          disabled={isSpinning}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-0 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-3xl font-bold text-gold mb-8 drop-shadow-sm">운명의 룰렛</h2>
        
        <div className="relative mb-8 transform scale-110">
          {/* Pointer */}
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
            <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-red-500 filter drop-shadow-lg"></div>
          </div>

          {/* Wheel Shadow */}
          <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.3)]"></div>

          {/* Wheel */}
          <div 
            ref={wheelRef}
            className="w-72 h-72 rounded-full border-8 border-white outline outline-4 outline-gold relative overflow-hidden transition-transform duration-[5000ms] cubic-bezier(0.25, 0.1, 0.25, 1)"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {/* Conic Gradient Background */}
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(
                  ${SECTORS[0].color} 0deg 120deg, 
                  ${SECTORS[1].color} 120deg 240deg, 
                  ${SECTORS[2].color} 240deg 360deg
                )`
              }}
            />
            
            {/* Sector Dividers */}
            {[0, 120, 240].map((deg) => (
              <div 
                key={deg}
                className="absolute top-0 left-1/2 w-1 h-1/2 bg-white opacity-30 origin-bottom transform -translate-x-1/2"
                style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
              />
            ))}
            
            {/* Labels */}
            {SECTORS.map((sector, index) => {
              const angle = index * 120 + 60; // Center of the sector
              return (
                <div
                  key={sector.label}
                  className="absolute top-1/2 left-1/2 text-white font-bold text-2xl transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -90px) rotate(-${angle}deg)`,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                  }}
                >
                  <span className="whitespace-nowrap">{sector.label}</span>
                </div>
              );
            })}
            
            {/* Center Cap */}
            <div className="absolute top-1/2 left-1/2 w-12 h-12 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-inner border-4 border-gray-100 z-10 flex items-center justify-center">
              <div className="w-3 h-3 bg-gold rounded-full opacity-50"></div>
            </div>
          </div>
        </div>

        <div className="text-center h-16 flex items-center justify-center w-full">
          {isSpinning ? (
            <p className="text-xl font-bold text-gold animate-pulse">
              두근두근...
            </p>
          ) : (
            <button
              onClick={handleSpin}
              className="px-12 py-4 bg-gold text-white rounded-full text-2xl font-bold shadow-lg hover:bg-opacity-90 transform hover:scale-105 active:scale-95 transition-all"
            >
              돌리기!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}