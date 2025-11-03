'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface PlayerImageProps {
  playerId: string | number;
  playerName: string;
  className?: string;
  size?: number;
  fallbackInitial?: string;
  priority?: boolean;
}

export default function PlayerImage({
  playerId,
  playerName,
  className = '',
  size = 100,
  fallbackInitial,
  priority = false,
}: PlayerImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Since all images are .webp, start with that directly
  const imageSrc = `/images/players/${playerId}.webp`;

  const getInitial = () => {
    if (fallbackInitial) return fallbackInitial;
    return playerName ? playerName[0].toUpperCase() : '?';
  };

  if (imageError) {
    // Fallback: Show initial letter
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold ${className}`}
        style={{ width: size, height: size }}
      >
        <span style={{ fontSize: size * 0.5 }}>{getInitial()}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: size, height: size }}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      
      <Image
        src={imageSrc}
        alt={playerName}
        fill
        className="object-cover"
        onError={() => setImageError(true)}
        onLoad={() => setIsLoading(false)}
        priority={priority}
        sizes={`${size}px`}
        unoptimized={false}
      />
    </div>
  );
}

// Simpler version for use in tables/lists
export function PlayerAvatar({
  playerId,
  playerName,
  size = 40,
  priority = false,
}: {
  playerId: string | number;
  playerName: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <PlayerImage
      playerId={playerId}
      playerName={playerName}
      size={size}
      className="rounded-full"
      priority={priority}
    />
  );
}

// Version for player cards
export function PlayerCard({
  playerId,
  playerName,
  priority = false,
}: {
  playerId: string | number;
  playerName: string;
  priority?: boolean;
}) {
  return (
    <PlayerImage
      playerId={playerId}
      playerName={playerName}
      size={160}
      className="rounded-xl"
      priority={priority}
    />
  );
}
