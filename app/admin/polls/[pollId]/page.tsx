'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Vote {
  vote_id: string;
  voter_name: string;
  selected_option_id: string;
  device_fingerprint: string;
  ip_address: string;
  voted_at: string;
  is_flagged: boolean;
  flag_reason: string | null;
}

interface Stats {
  total_votes: number;
  flagged_votes: number;
  option_breakdown: Array<{
    selected_option_id: string;
    vote_count: number;
    flagged_count: number;
  }>;
  duplicate_names: Array<{
    voter_name: string;
    device_count: number;
    vote_count: number;
    devices: string[];
  }>;
}

export default function AdminPollPage() {
  const params = useParams();
  const router = useRouter();
  const pollId = params?.pollId as string;

  const [votes, setVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [deletingVoteId, setDeletingVoteId] = useState<string | null>(null);

  useEffect(() => {
    if (pollId) {
      fetchVotes();
    }
  }, [pollId, showFlaggedOnly]);

  const fetchVotes = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/polls/${pollId}/votes${showFlaggedOnly ? '?flagged_only=true' : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setVotes(data.votes);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch votes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVote = async (voteId: string) => {
    if (!confirm('Are you sure you want to delete this vote?')) return;

    setDeletingVoteId(voteId);
    try {
      const response = await fetch(`/api/admin/polls/${pollId}/votes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_id: voteId })
      });

      const data = await response.json();
      if (data.success) {
        fetchVotes(); // Reload votes
      } else {
        alert(`Failed to delete: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to delete vote:', error);
      alert('Failed to delete vote');
    } finally {
      setDeletingVoteId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-300 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Admin
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Poll Vote Management</h1>
          <p className="text-gray-600 mt-2">Poll ID: {pollId}</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-sm text-gray-600 mb-1">Total Votes</div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_votes}</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-sm text-gray-600 mb-1">Flagged Votes</div>
              <div className="text-3xl font-bold text-red-600">{stats.flagged_votes}</div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="text-sm text-gray-600 mb-1">Duplicate Names</div>
              <div className="text-3xl font-bold text-orange-600">{stats.duplicate_names.length}</div>
            </div>
          </div>
        )}

        {/* Duplicate Names Alert */}
        {stats && stats.duplicate_names.length > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-6 mb-8 rounded-lg">
            <h3 className="font-bold text-orange-900 mb-3">⚠️ Duplicate Names Detected</h3>
            <div className="space-y-2">
              {stats.duplicate_names.map((dup) => (
                <div key={dup.voter_name} className="text-sm text-orange-800">
                  <span className="font-medium">{dup.voter_name}</span> used on{' '}
                  <span className="font-bold">{dup.device_count} different devices</span>
                  {' '}({dup.vote_count} votes)
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showFlaggedOnly}
                onChange={(e) => setShowFlaggedOnly(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Show flagged votes only</span>
            </label>
            <div className="ml-auto text-sm text-gray-600">
              Showing {votes.length} {showFlaggedOnly ? 'flagged ' : ''}votes
            </div>
          </div>
        </div>

        {/* Votes Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Voter Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Option</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">IP Address</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Voted At</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {votes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No votes found
                    </td>
                  </tr>
                ) : (
                  votes.map((vote) => (
                    <tr key={vote.vote_id} className={vote.is_flagged ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{vote.voter_name}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {vote.device_fingerprint.slice(0, 12)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {vote.selected_option_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-mono">
                        {vote.ip_address}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(vote.voted_at)}
                      </td>
                      <td className="px-6 py-4">
                        {vote.is_flagged ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                            </svg>
                            Flagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Valid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteVote(vote.vote_id)}
                          disabled={deletingVoteId === vote.vote_id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {deletingVoteId === vote.vote_id ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Option Breakdown */}
        {stats && stats.option_breakdown.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6 mt-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Vote Distribution by Option</h3>
            <div className="space-y-3">
              {stats.option_breakdown.map((opt) => (
                <div key={opt.selected_option_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{opt.selected_option_id}</div>
                    <div className="text-sm text-gray-600">{opt.vote_count} votes</div>
                  </div>
                  {opt.flagged_count > 0 && (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      {opt.flagged_count} flagged
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
