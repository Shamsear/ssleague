'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PollOption {
  id: string;
  text_en: string;
  text_ml: string;
  votes: number;
}

interface Poll {
  id: string;
  question_en: string;
  question_ml: string;
  description_en?: string;
  description_ml?: string;
  options: PollOption[];
  total_votes: number;
  closes_at: string | null;
  is_closed: boolean;
  user_vote?: string | null;
}

interface PollWidgetProps {
  poll: Poll;
  onVote?: (pollId: string, optionId: string) => Promise<void>;
  showResults?: boolean;
  className?: string;
}

export default function PollWidget({ poll, onVote, showResults = false, className = '' }: PollWidgetProps) {
  const { language } = useLanguage();
  const [selectedOption, setSelectedOption] = useState<string | null>(poll.user_vote || null);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(!!poll.user_vote);
  const [error, setError] = useState<string | null>(null);

  const question = language === 'en' ? poll.question_en : poll.question_ml;
  const description = language === 'en' ? poll.description_en : poll.description_ml;

  const handleVote = async (optionId: string) => {
    if (isVoting || hasVoted || poll.is_closed) return;

    setIsVoting(true);
    setError(null);

    try {
      if (onVote) {
        await onVote(poll.id, optionId);
      }
      setSelectedOption(optionId);
      setHasVoted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (votes: number) => {
    if (poll.total_votes === 0) return 0;
    return Math.round((votes / poll.total_votes) * 100);
  };

  const shouldShowResults = showResults || hasVoted || poll.is_closed;

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Poll Question */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{question}</h3>
        {description && <p className="text-sm text-gray-600">{description}</p>}
      </div>

      {/* Status Badge */}
      {poll.is_closed && (
        <div className="mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            {language === 'en' ? 'Closed' : 'അവസാനിച്ചു'}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Poll Options */}
      <div className="space-y-3">
        {poll.options.map((option) => {
          const optionText = language === 'en' ? option.text_en : option.text_ml;
          const percentage = getPercentage(option.votes);
          const isSelected = selectedOption === option.id;

          return (
            <div key={option.id}>
              {shouldShowResults ? (
                // Results view
                <div
                  className={`relative overflow-hidden rounded-lg border-2 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* Progress bar */}
                  <div
                    className={`absolute inset-0 ${
                      isSelected ? 'bg-blue-200' : 'bg-gray-200'
                    } transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                  
                  {/* Content */}
                  <div className="relative px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                        {optionText}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">{option.votes} votes</span>
                      <span className={`text-lg font-bold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                        {percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                // Voting view
                <button
                  onClick={() => handleVote(option.id)}
                  disabled={isVoting || poll.is_closed}
                  className={`w-full px-4 py-3 rounded-lg border-2 text-left font-medium transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-900 hover:border-blue-300 hover:bg-blue-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {optionText}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Total Votes */}
      {shouldShowResults && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            {language === 'en' ? 'Total votes' : 'ആകെ വോട്ടുകൾ'}: {poll.total_votes.toLocaleString()}
          </p>
        </div>
      )}

      {/* Closes At */}
      {poll.closes_at && !poll.is_closed && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            {language === 'en' ? 'Closes at' : 'അവസാന തീയതി'}:{' '}
            {new Date(poll.closes_at).toLocaleString(language === 'en' ? 'en-US' : 'ml-IN')}
          </p>
        </div>
      )}
    </div>
  );
}
