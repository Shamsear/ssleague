'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClaimFantasyTeamPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const [teamId, setTeamId] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleClaim = async () => {
    if (!user || !teamId) {
      setMessage('Please enter your team ID');
      return;
    }

    setClaiming(true);
    setMessage('');

    try {
      const response = await fetch('/api/fantasy/teams/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          team_id: teamId.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim team');
      }

      setMessage('✅ Success! Redirecting to your fantasy team...');
      setTimeout(() => {
        router.push('/dashboard/team/fantasy/my-team');
      }, 2000);

    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : 'Failed to claim team'}`);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Claim Your Fantasy Team
          </h1>
          <p className="text-gray-600">
            If an admin registered you for the fantasy league, enter your Team ID to claim it
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Team ID
            </label>
            <input
              type="text"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="e.g., SSPSLT0018"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={claiming}
            />
            <p className="text-xs text-gray-500 mt-1">
              Ask the admin for your Team ID if you don't know it
            </p>
          </div>

          <button
            onClick={handleClaim}
            disabled={claiming || !teamId}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {claiming ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Claiming...
              </span>
            ) : (
              '🎮 Claim Fantasy Team'
            )}
          </button>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.startsWith('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="pt-4 border-t">
            <Link
              href="/dashboard/team/fantasy/my-team"
              className="block text-center text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Already claimed? Go to My Team →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
