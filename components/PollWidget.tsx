'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getFingerprint } from '@/lib/utils/device-fingerprint';

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
  const [showNameModal, setShowNameModal] = useState(false);
  const [voterName, setVoterName] = useState('');
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);

  const question = language === 'en' ? poll.question_en : poll.question_ml;
  const description = language === 'en' ? poll.description_en : poll.description_ml;

  useEffect(() => {
    // Get device fingerprint and check if already voted
    getFingerprint().then(fp => {
      setDeviceFingerprint(fp);
      checkVoteStatus(fp);
    });
  }, [poll.id]);

  const checkVoteStatus = async (fingerprint: string) => {
    try {
      const response = await fetch(`/api/polls/${poll.id}/vote?device_fingerprint=${fingerprint}`);
      const data = await response.json();
      
      if (data.success && data.has_voted) {
        setHasVoted(true);
        setSelectedOption(data.vote.selected_option_id);
      }
    } catch (err) {
      console.error('Failed to check vote status:', err);
    }
  };

  const handleVoteClick = (optionId: string) => {
    if (hasVoted || poll.is_closed) return;
    
    // Show name prompt modal
    setPendingOptionId(optionId);
    setShowNameModal(true);
  };

  const submitVote = async () => {
    if (!pendingOptionId || !deviceFingerprint) return;
    if (!voterName || voterName.trim().length < 3) {
      setError(language === 'en' ? 'Please enter your name (minimum 3 characters)' : 'നിങ്ങളുടെ പേര് നൽകുക (കുറഞ്ഞത് 3 അക്ഷരങ്ങൾ)');
      return;
    }

    setIsVoting(true);
    setError(null);

    try {
      const response = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_option_id: pendingOptionId,
          voter_name: voterName.trim(),
          device_fingerprint: deviceFingerprint,
          user_agent: navigator.userAgent,
          browser_info: {
            language: navigator.language,
            platform: navigator.platform
          }
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit vote');
      }

      setSelectedOption(pendingOptionId);
      setHasVoted(true);
      setShowNameModal(false);
      
      if (data.flagged) {
        setError(language === 'en' 
          ? 'Vote recorded but flagged for review'
          : 'വോട്ട് രേഖപ്പെടുത്തി എന്നാൽ പരിശോധനയ്ക്കായി ഫ്ലാഗ് ചെയ്തു'
        );
      }
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
                  onClick={() => handleVoteClick(option.id)}
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

      {/* Name Prompt Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {language === 'en' ? 'Enter Your Name' : 'നിങ്ങളുടെ പേര് നൽകുക'}
              </h3>
              <p className="text-sm text-gray-600">
                {language === 'en' 
                  ? 'Please provide your name to vote. One vote per device.'
                  : 'വോട്ട് രേഖപ്പെടുത്താൻ നിങ്ങളുടെ പേര് നൽകുക. ഒരു ഉപകരണത്തിന് ഒരു വോട്ട്.'}
              </p>
            </div>

            <input
              type="text"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              placeholder={language === 'en' ? 'Your full name' : 'നിങ്ങളുടെ മുഴുവൻ പേര്'}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none mb-4"
              maxLength={50}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submitVote()}
            />

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setPendingOptionId(null);
                  setVoterName('');
                  setError(null);
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                disabled={isVoting}
              >
                {language === 'en' ? 'Cancel' : 'റദ്ദാക്കുക'}
              </button>
              <button
                onClick={submitVote}
                disabled={isVoting || !voterName.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVoting 
                  ? (language === 'en' ? 'Submitting...' : 'സമർപ്പിക്കുന്നു...')
                  : (language === 'en' ? 'Submit Vote' : 'വോട്ട് രേഖപ്പെടുത്തുക')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
