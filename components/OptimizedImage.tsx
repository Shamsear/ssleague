'use client';

import { useState } from 'react';
import { getOptimizedImageUrl } from '@/lib/imagekit/upload';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * Optimized Image component using ImageKit
 * Automatically applies transformations for better performance
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  quality = 80,
  className = '',
  fallback,
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get optimized URL if it's an ImageKit URL
  const optimizedSrc = src.includes('imagekit.io')
    ? getOptimizedImageUrl(src, {
        width,
        height,
        quality,
        format: 'auto',
        crop: 'maintain_ratio',
      })
    : src;

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative">
      {loading && (
        <div className={`absolute inset-0 bg-gray-200 animate-pulse rounded ${className}`} />
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        className={className}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
}
