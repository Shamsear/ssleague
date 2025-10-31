'use client';

import React from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

interface PollCardData {
  id: string;
  question_en: string;
  question_ml: string;
  description_en?: string;
  description_ml?: string;
  poll_type: string;
  total_votes: number;
  closes_at: string | null;
  is_closed: boolean;
  options_count?: number;
  user_voted?: boolean;
}

interface PollCardProps {
  poll: PollCardData;
  onClick?: () => void;
  showLink?: boolean;
  className?: string;
}

export default function PollCard({ poll, onClick, showLink = true, className = '' }: PollCardProps) {
  const { language } = useLanguage();

  const question = language === 'en' ? poll.question_en : poll.question_ml;
  const description = language === 'en' ? poll.description_en : poll.description_ml;

  const getStatusBadge = () => {
    if (poll.is_closed) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
          {language === 'en' ? 'Closed' : 'അവസാനിച്ചു'}
        </span>
      );
    }

    if (poll.user_voted) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {language === 'en' ? 'Voted' : 'വോട്ട് ചെയ്തു'}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        {language === 'en' ? 'Active' : 'സജീവം'}
      </span>
    );
  };

  const getPollTypeLabel = () => {
    const typeMap: Record<string, { en: string; ml: string }> = {
      match_prediction: { en: 'Match Prediction', ml: 'മാച്ച് പ്രവചനം' },
      player_of_match: { en: 'Player of the Match', ml: 'മാച്ചിലെ മികച്ച കളിക്കാരൻ' },
      daily_best_player: { en: 'Best Player', ml: 'മികച്ച കളിക്കാരൻ' },
      daily_best_team: { en: 'Best Team', ml: 'മികച്ച ടീം' },
      weekly_top_player: { en: 'Top Player', ml: 'മികച്ച കളിക്കാരൻ' },
      weekly_top_team: { en: 'Top Team', ml: 'മികച്ച ടീം' },
      season_champion: { en: 'Season Champion', ml: 'സീസൺ ചാമ്പ്യൻ' },
      season_mvp: { en: 'Season MVP', ml: 'സീസൺ MVP' },
      custom: { en: 'Poll', ml: 'പോൾ' },
    };

    const type = typeMap[poll.poll_type] || typeMap.custom;
    return language === 'en' ? type.en : type.ml;
  };

  const cardContent = (
    <div
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {getPollTypeLabel()}
            </span>
            {getStatusBadge()}
          </div>
          <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{question}</h3>
        </div>
        
        {/* Poll Icon */}
        <div className="ml-3 flex-shrink-0">
          <svg
            className="w-8 h-8 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4">
          {/* Total Votes */}
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            <span>{poll.total_votes.toLocaleString()}</span>
          </div>

          {/* Options Count */}
          {poll.options_count && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <span>
                {poll.options_count} {language === 'en' ? 'options' : 'ഓപ്ഷനുകൾ'}
              </span>
            </div>
          )}
        </div>

        {/* Closes At */}
        {poll.closes_at && !poll.is_closed && (
          <div className="text-xs text-gray-400">
            {language === 'en' ? 'Closes' : 'അവസാനിക്കുന്നു'}:{' '}
            {new Date(poll.closes_at).toLocaleDateString(language === 'en' ? 'en-US' : 'ml-IN', {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (showLink) {
    return <Link href={`/polls/${poll.id}`}>{cardContent}</Link>;
  }

  return cardContent;
}
