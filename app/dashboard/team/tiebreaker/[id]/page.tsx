'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRetry } from '@/lib/fetch-with-retry';

import { fetchWithTokenRefresh } from '@/lib/token-refresh';
interface TiebreakerDetail {
  id: string;
  round_id: string;
  round_position: string;
  player: {
    id: string;
    name: string;
    position: string;
    overall_rating: number;
    team_name: string;
  };
  original_amount: number;
  status: string;
  duration_minutes: number | null;
  created_at: string;
  new_amount: number | null;
  submitted: boolean;
  submitted_at: string | null;
  expiresAt: string | null;
  timeRemaining: number;
  isExpired: boolean;
  hasTimeLimit: boolean;
}

export default function TeamTiebreakerPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, loading, firebaseUser } = useAuth();
  const router = useRouter();
  const [tiebreakerId, setTiebreakerId] = useState<string | null>(null);
  const [tiebreaker, setTiebreaker] = useState<TiebreakerDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [bidAmount, setBidAmount] = useState<number | ''>('');
  const [hasUserModifiedBid, setHasUserModifiedBid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [teamBalance, setTeamBalance] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    params.then(({ id }) => setTiebreakerId(id));
  }, [params]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchTiebreakerDetails = async () => {
    if (!tiebreakerId) return;
    
    try {
      // Refresh token before API call
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true);
          await fetchWithTokenRefresh('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
          });
        } catch (tokenError) {
          console.error('Token refresh failed:', tokenError);
        }
      }
      
      const response = await fetchWithTokenRetry(`/api/tiebreakers/${tiebreakerId}`);
      const result = await response.json();
      
      console.log('🔍 Tiebreaker API response:', result);
      
      if (result.success) {
        // Find the current user's team data using is_current_user flag
        const teamTiebreaker = result.data.teamTiebreakers.find(
          (t: any) => t.is_current_user === true
        );
        
        console.log('💰 Current user team tiebreaker:', teamTiebreaker);
        
        const durationMinutes = result.data.tiebreaker.duration_minutes;
        const hasTimeLimit = durationMinutes !== null;
        
        setTiebreaker({
          id: result.data.tiebreaker.id,
          round_id: result.data.tiebreaker.round_id,
          round_position: result.data.tiebreaker.round_position,
          player: {
            id: result.data.tiebreaker.player_id,
            name: result.data.tiebreaker.player_name,
            position: result.data.tiebreaker.position,
            overall_rating: result.data.tiebreaker.overall_rating,
            team_name: result.data.tiebreaker.player_team,
          },
          original_amount: result.data.tiebreaker.original_amount,
          status: result.data.tiebreaker.status,
          duration_minutes: durationMinutes,
          created_at: result.data.tiebreaker.created_at,
          new_amount: teamTiebreaker?.new_bid_amount || null,
          submitted: teamTiebreaker?.submitted || false,
          submitted_at: teamTiebreaker?.submitted_at || null,
          expiresAt: hasTimeLimit
            ? new Date(
                new Date(result.data.tiebreaker.created_at).getTime() +
                  durationMinutes * 60 * 1000
              ).toISOString()
            : null,
          timeRemaining: 0, // Will be calculated dynamically
          isExpired: false, // Will be calculated dynamically
          hasTimeLimit,
        });
        
        setTeamBalance(teamTiebreaker?.team_balance || 0);
      } else {
        setError(result.error || 'Failed to load tiebreaker details');
      }
    } catch (error) {
      console.error('Error fetching tiebreaker:', error);
      setError('An error occurred while loading the tiebreaker');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && tiebreakerId) {
      fetchTiebreakerDetails();
      
      // Auto-refresh every 3 seconds, but stop if resolved/completed
      const interval = setInterval(() => {
        // Stop polling if tiebreaker is resolved or completed
        if (tiebreaker?.status === 'resolved' || tiebreaker?.status === 'completed') {
          clearInterval(interval);
          return;
        }
        fetchTiebreakerDetails();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [user, tiebreakerId, tiebreaker?.status]);

  // Redirect when tiebreaker is completed, resolved, or expired
  useEffect(() => {
    if (!tiebreaker) return;
    
    // Redirect if tiebreaker is resolved or completed
    if (tiebreaker.status === 'resolved' || tiebreaker.status === 'completed') {
      console.log(`✅ Tiebreaker ${tiebreaker.status}, redirecting to dashboard...`);
      const redirectTimer = setTimeout(() => {
        router.push('/dashboard/team');
      }, 2000); // Wait 2 seconds to show message
      
      return () => clearTimeout(redirectTimer);
    }
  }, [tiebreaker?.status, router]);

  // Update current time every second for dynamic timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tiebreaker) return;
    
    const amount = typeof bidAmount === 'number' ? Math.floor(bidAmount) : 0;
    
    // Validation
    if (amount < Math.floor(tiebreaker.original_amount)) {
      setError(`Bid must be at least £${Math.floor(tiebreaker.original_amount).toLocaleString()} (the tied bid amount)`);
      return;
    }
    
    if (amount > teamBalance) {
      setError(`Bid exceeds your balance of £${teamBalance.toLocaleString()}`);
      return;
    }
    
    setError('');
    setSubmitting(true);
    
    console.log('💰 Submitting tiebreaker bid:', { amount, bidAmount, tiebreakerId });
    
    try {
      // Refresh token before submitting
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true);
          await fetchWithTokenRefresh('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
          });
        } catch (tokenError) {
          console.error('Token refresh failed:', tokenError);
        }
      }
      
      const response = await fetchWithTokenRetry(`/api/tiebreakers/${tiebreakerId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newBidAmount: amount }),
      });
      
      console.log('📤 Sent bid amount:', amount);
      
      const result = await response.json();
      
      console.log('📬 API Response:', result);
      
      if (result.success) {
        // Clear any previous errors
        setError('');
        
        // Log success with details
        if (result.message) {
          console.log('✅ Success:', result.message);
        }
        if (result.data) {
          console.log('📊 Details:', result.data);
        }
        
        // Refresh to show submitted state
        fetchTiebreakerDetails();
      } else {
        // Show error message from API
        setError(result.error || 'Failed to submit bid');
      }
    } catch (error) {
      console.error('Error submitting bid:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate time remaining dynamically
  const getTimeRemaining = () => {
    if (!tiebreaker) return Infinity;
    // If duration_minutes is null, tiebreaker never expires
    if (tiebreaker.duration_minutes === null || tiebreaker.duration_minutes === undefined) return Infinity;
    if (!tiebreaker.hasTimeLimit || !tiebreaker.expiresAt) return Infinity;
    const expiryTime = new Date(tiebreaker.expiresAt).getTime();
    return Math.max(0, expiryTime - currentTime);
  };

  const isExpired = () => {
    if (!tiebreaker) return false;
    // If duration_minutes is null, tiebreaker never expires
    if (tiebreaker.duration_minutes === null || tiebreaker.duration_minutes === undefined) return false;
    if (!tiebreaker.hasTimeLimit) return false; // No time limit = never expires
    return getTimeRemaining() === 0;
  };

  const formatTimeRemaining = (timeRemaining: number) => {
    if (!tiebreaker?.hasTimeLimit) return 'No time limit';
    if (timeRemaining === 0) return 'Expired';
    if (timeRemaining === Infinity) return 'No time limit';
    
    const milliseconds = timeRemaining;
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s remaining`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s remaining`;
    return `${seconds}s remaining`;
  };

  if (loading || !user || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!tiebreaker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error || 'Tiebreaker not found'}</p>
          <Link
            href="/dashboard/team"
            className="mt-4 inline-block text-[#0066FF] hover:underline"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="glass rounded-3xl p-6 sm:p-8 shadow-lg">
          {/* Header */}
          <div className="flex items-center mb-6">
            <div className="bg-yellow-100 p-2 rounded-full mr-3">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-grow">
              <h2 className="text-2xl font-bold text-dark">Tiebreaker Required</h2>
              <p className="text-sm text-gray-500">
                Round {tiebreaker.round_position} • {new Date(tiebreaker.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Balance</p>
              <p className="text-lg font-bold text-[#0066FF]">£{teamBalance.toLocaleString()}</p>
            </div>
          </div>

          {/* Status Alert */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-xl">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-yellow-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm text-yellow-800 font-bold">URGENT: Action Required</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your bid of <strong>£{Math.floor(tiebreaker.original_amount).toLocaleString()}</strong> for{' '}
                  <strong>{tiebreaker.player.name}</strong> is tied. Please submit a new higher bid to win this player.
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  <strong>{formatTimeRemaining(getTimeRemaining())}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Player Card */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Player Information
            </h3>
            <div className="bg-white/60 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center">
                <div className="bg-[#0066FF]/10 p-3 rounded-xl mr-4">
                  <span className="text-2xl font-bold text-[#0066FF]">{tiebreaker.player.position}</span>
                </div>
                <div className="flex-grow">
                  <h4 className="text-xl font-semibold text-dark">{tiebreaker.player.name}</h4>
                  <div className="flex items-center mt-1 gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      {tiebreaker.player.position}
                    </span>
                    {tiebreaker.player.team_name && (
                      <span className="text-xs text-gray-500">{tiebreaker.player.team_name}</span>
                    )}
                    {tiebreaker.player.overall_rating && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span className="text-sm font-medium">{tiebreaker.player.overall_rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">Original Bid:</p>
                      <p className="font-semibold text-[#0066FF]">£{Math.floor(tiebreaker.original_amount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Minimum New Bid:</p>
                      <p className="font-semibold text-[#0066FF]">
                        £{Math.floor(tiebreaker.original_amount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bid Submission */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
              <svg className="w-5 h-5 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Submit New Bid
            </h3>

            {tiebreaker.submitted ? (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-xl">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-green-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">
                      You have submitted a new bid of <strong>£{tiebreaker.new_amount?.toLocaleString()}</strong>.
                      Waiting for other teams to submit their bids...
                    </p>
                    <div className="mt-3 flex items-center">
                      <svg className="animate-spin h-4 w-4 text-green-600 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs text-green-600">Auto-refreshing...</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white/60 p-5 rounded-2xl shadow-sm">
                <div className="mb-4">
                  <label htmlFor="bidAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    New Bid Amount
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">£</span>
                    </div>
                    <input
                      type="number"
                      id="bidAmount"
                      value={bidAmount}
                      onChange={(e) => {
                        setHasUserModifiedBid(true);
                        const value = e.target.value;
                        const parsedValue = value === '' ? '' : Math.floor(parseFloat(value));
                        console.log('🔤 Input changed:', { rawValue: value, parsedValue, currentBidAmount: bidAmount });
                        setBidAmount(parsedValue);
                      }}
                      min={Math.floor(tiebreaker.original_amount)}
                      step="1"
                      disabled={tiebreaker.submitted}
                      className="block w-full pl-8 pr-20 py-3 border-gray-300 rounded-xl focus:ring-[#0066FF] focus:border-[#0066FF] text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center mr-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setHasUserModifiedBid(true);
                          const current = typeof bidAmount === 'number' && bidAmount > 0 ? bidAmount : Math.floor(tiebreaker.original_amount);
                          setBidAmount(Math.max(Math.floor(tiebreaker.original_amount), current - 1));
                        }}
                        disabled={tiebreaker.submitted}
                        className="p-1 text-gray-500 hover:text-[#0066FF] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasUserModifiedBid(true);
                          const current = typeof bidAmount === 'number' && bidAmount > 0 ? bidAmount : Math.floor(tiebreaker.original_amount);
                          setBidAmount(current + 1);
                        }}
                        disabled={tiebreaker.submitted}
                        className="p-1 text-gray-500 hover:text-[#0066FF] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <p className="text-gray-500">Minimum: £{Math.floor(tiebreaker.original_amount).toLocaleString()}</p>
                    <p className="text-gray-500">
                      Your balance: <span className="font-medium text-[#0066FF]">£{Math.floor(teamBalance).toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 rounded-r-xl text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setHasUserModifiedBid(true);
                      setBidAmount(Math.floor(tiebreaker.original_amount) + 10);
                    }}
                    className="px-4 py-2 bg-blue-100 text-blue-700 font-medium rounded-xl hover:bg-blue-200 transition-colors"
                  >
                    Quick Bid: £{(Math.floor(tiebreaker.original_amount) + 10).toLocaleString()}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#0066FF] text-white font-medium rounded-xl hover:bg-[#0052CC] transition-colors disabled:opacity-50 flex items-center"
                  >
                    {submitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Submit New Bid
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center">
            <Link
              href="/dashboard/team"
              className="flex items-center text-gray-600 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
