'use client';

import Image from 'next/image';
import { useMemo } from 'react';

interface PlayerPhotoProps {
  photoUrl?: string;
  playerName: string;
  shape?: 'circle' | 'square';
  size?: number;
  className?: string;
  positionCircle?: string;
  scaleCircle?: number;
  posXCircle?: number;
  posYCircle?: number;
  positionSquare?: string;
  scaleSquare?: number;
  posXSquare?: number;
  posYSquare?: number;
  showFallback?: boolean;
}

export default function PlayerPhoto({
  photoUrl,
  playerName,
  shape = 'circle',
  size = 80,
  className = '',
  positionCircle,
  scaleCircle,
  posXCircle,
  posYCircle,
  positionSquare,
  scaleSquare,
  posXSquare,
  posYSquare,
  showFallback = true,
}: PlayerPhotoProps) {
  
  // Determine which settings to use based on shape
  const { position, scale, posX, posY } = useMemo(() => {
    if (shape === 'circle') {
      return {
        position: positionCircle || 'center',
        scale: scaleCircle || 1,
        posX: posXCircle ?? 50,
        posY: posYCircle ?? 50,
      };
    } else {
      return {
        position: positionSquare || 'center',
        scale: scaleSquare || 1,
        posX: posXSquare ?? 50,
        posY: posYSquare ?? 50,
      };
    }
  }, [shape, positionCircle, scaleCircle, posXCircle, posYCircle, positionSquare, scaleSquare, posXSquare, posYSquare]);

  // Calculate final position
  const displayPosition = position === 'custom' ? `${posX}% ${posY}%` : position;

  const wrapperClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const initials = playerName.charAt(0).toUpperCase();

  return (
    <div 
      className={`relative overflow-hidden bg-gray-100 ${wrapperClass} ${className}`}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={playerName}
          fill
          className="object-cover"
          style={{
            objectPosition: `${posX}% ${posY}%`,
            transform: `scale(${scale})`,
            transformOrigin: `${posX}% ${posY}%`
          }}
          unoptimized
        />
      ) : showFallback ? (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
          <span className="text-xl font-bold text-blue-600">{initials}</span>
        </div>
      ) : null}
    </div>
  );
}
