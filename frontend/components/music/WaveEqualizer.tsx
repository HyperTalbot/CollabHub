'use client';

import React from 'react';

interface WaveEqualizerProps {
  isPlaying: boolean;
}

export const WaveEqualizer: React.FC<WaveEqualizerProps> = ({ isPlaying }) => {
  if (!isPlaying) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Внешняя волна */}
      <div className="absolute w-32 h-32 border-4 border-blue-400/60 rounded-full animate-ping"></div>
      
      {/* Средняя волна */}
      <div className="absolute w-28 h-28 border-4 border-purple-400/50 rounded-full animate-pulse"></div>
      
      {/* Внутренняя волна */}
      <div className="absolute w-24 h-24 border-4 border-pink-400/40 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
      
      {/* Точки эквалайзера */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(8)].map((_, i) => {
          const angle = (i * 45) * Math.PI / 180;
          const radius = 50;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          
          return (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full animate-pulse"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s'
              }}
            />
          );
        })}
      </div>
    </div>
  );
};