'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewsCardData {
  id: string;
  title_en?: string;
  title_ml?: string;
  title?: string; // Legacy support
  content_en?: string;
  content_ml?: string;
  content?: string; // Legacy support
  summary_en?: string;
  summary_ml?: string;
  summary?: string; // Legacy support
  category: string;
  event_type: string;
  image_url?: string;
  created_at: string;
  published_at?: string;
  is_published: boolean;
  reporter_en?: string;
  reporter_ml?: string;
  tone?: string;
}

interface NewsCardProps {
  news: NewsCardData;
  onClick?: () => void;
  showLink?: boolean;
  showImage?: boolean;
  compact?: boolean;
  className?: string;
}

export default function NewsCard({
  news,
  onClick,
  showLink = true,
  showImage = true,
  compact = false,
  className = '',
}: NewsCardProps) {
  const { language } = useLanguage();

  // Support both bilingual and legacy single-language content
  const title = language === 'en'
    ? (news.title_en || news.title || '')
    : (news.title_ml || news.title || '');
  
  const summary = language === 'en'
    ? (news.summary_en || news.summary || '')
    : (news.summary_ml || news.summary || '');
  
  const reporter = language === 'en'
    ? (news.reporter_en || 'Reporter')
    : (news.reporter_ml || 'റിപ്പോർട്ടർ');

  const getCategoryLabel = () => {
    const categoryMap: Record<string, { en: string; ml: string }> = {
      tournament: { en: 'Tournament', ml: 'ടൂർണമെന്റ്' },
      player: { en: 'Player', ml: 'കളിക്കാരൻ' },
      team: { en: 'Team', ml: 'ടീം' },
      match: { en: 'Match', ml: 'മാച്ച്' },
      season: { en: 'Season', ml: 'സീസൺ' },
      announcement: { en: 'Announcement', ml: 'അറിയിപ്പ്' },
      other: { en: 'News', ml: 'വാർത്ത' },
    };

    const cat = categoryMap[news.category] || categoryMap.other;
    return language === 'en' ? cat.en : cat.ml;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'ml-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const cardContent = (
    <article
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {/* Image */}
      {showImage && news.image_url && (
        <div className={`relative w-full ${compact ? 'h-40' : 'h-48'} bg-gray-200`}>
          <img
            src={news.image_url}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className={compact ? 'p-4' : 'p-5'}>
        {/* Category Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {getCategoryLabel()}
          </span>
          {news.tone && (
            <span className="text-xs text-gray-500 capitalize">{news.tone}</span>
          )}
        </div>

        {/* Title */}
        <h3 className={`font-bold text-gray-900 mb-2 ${compact ? 'text-base line-clamp-2' : 'text-lg line-clamp-3'}`}>
          {title}
        </h3>

        {/* Summary */}
        {summary && !compact && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-3">{summary}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* Reporter Icon */}
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
            <span>{reporter}</span>
          </div>
          
          {/* Date */}
          <time dateTime={news.published_at || news.created_at}>
            {formatDate(news.published_at || news.created_at)}
          </time>
        </div>
      </div>
    </article>
  );

  if (showLink) {
    return <Link href={`/news/${news.id}`}>{cardContent}</Link>;
  }

  return cardContent;
}
