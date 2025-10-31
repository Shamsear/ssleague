'use client';

import { useState, useEffect } from 'react';
import { getFingerprint } from '@/lib/utils/device-fingerprint';

interface NewsReactionsProps {
  newsId: string;
}

const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'dislike', emoji: '👎', label: 'Dislike' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'funny', emoji: '😂', label: 'Funny' },
  { type: 'insightful', emoji: '💡', label: 'Insightful' },
  { type: 'inspiring', emoji: '🌟', label: 'Inspiring' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😠', label: 'Angry' },
];

export default function NewsReactions({ newsId }: NewsReactionsProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReactions();
  }, [newsId]);

  const loadReactions = async () => {
    try {
      const fingerprint = await getFingerprint();
      const response = await fetch(`/api/news/${newsId}/react?device_fingerprint=${fingerprint}`);
      const data = await response.json();
      
      if (data.success) {
        setCounts(data.counts || {});
        setUserReaction(data.user_reaction);
      }
    } catch (error) {
      console.error('Failed to load reactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReact = async (type: string) => {
    try {
      const fingerprint = await getFingerprint();
      
      const response = await fetch(`/api/news/${newsId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reaction_type: type,
          device_fingerprint: fingerprint
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setUserReaction(type);
        loadReactions(); // Reload counts
      }
    } catch (error) {
      console.error('Failed to react:', error);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse h-12 bg-gray-200 rounded-lg"></div>;
  }

  return (
    <div className="border-t border-gray-200 pt-4 mt-6">
      <p className="text-sm font-medium text-gray-700 mb-3">
        How did you find this article?
      </p>
      
      <div className="flex flex-wrap gap-2">
        {REACTIONS.map(({ type, emoji, label }) => {
          const count = counts[type] || 0;
          const isSelected = userReaction === type;
          
          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 bg-white'
              }`}
              title={label}
            >
              <span className="text-xl">{emoji}</span>
              {count > 0 && (
                <span className={`text-sm font-medium ${
                  isSelected ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {userReaction && (
        <p className="text-xs text-gray-500 mt-2">
          ✓ You reacted with {REACTIONS.find(r => r.type === userReaction)?.emoji}
        </p>
      )}
    </div>
  );
}
