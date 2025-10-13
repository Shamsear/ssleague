'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  getAllPasswordResetRequests, 
  approveResetRequest, 
  rejectResetRequest,
  deleteResetRequest 
} from '@/lib/firebase/passwordResetRequests';
import { PasswordResetRequest } from '@/types/passwordResetRequest';

export default function PasswordRequestsManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PasswordResetRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'super_admin') {
      fetchRequests();
    }
  }, [user]);

  useEffect(() => {
    let filtered = requests;
    
    if (filter === 'pending') {
      filtered = requests.filter(r => r.status === 'pending');
    } else if (filter === 'approved') {
      filtered = requests.filter(r => r.status === 'approved');
    } else if (filter === 'rejected') {
      filtered = requests.filter(r => r.status === 'rejected');
    }
    
    setFilteredRequests(filtered);
  }, [requests, filter]);

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const allRequests = await getAllPasswordResetRequests();
      setRequests(allRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
      alert('Failed to load password reset requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!user) return;
    
    const notes = prompt('Optional: Add notes for this approval');
    
    try {
      const resetLink = await approveResetRequest(requestId, {
        reviewedBy: user.uid,
        adminNotes: notes || undefined,
      });
      
      setGeneratedLink(resetLink);
      setShowLinkModal(true);
      await fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleReject = async (requestId: string) => {
    if (!user) return;
    
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
      await rejectResetRequest(requestId, {
        reviewedBy: user.uid,
        adminNotes: reason,
      });
      
      alert('Request rejected successfully');
      await fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request');
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteResetRequest(requestId);
      alert('Request deleted successfully');
      await fetchRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
      alert('Failed to delete request');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard!');
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || loadingRequests) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => router.push('/dashboard/superadmin')}
                  className="p-2 rounded-xl hover:bg-white/50 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-3xl md:text-4xl font-bold gradient-text">Password Reset Requests</h1>
              </div>
              <p className="text-gray-600 text-sm md:text-base ml-14">
                Review and manage password reset requests
              </p>
            </div>
            <button
              onClick={fetchRequests}
              className="hidden md:flex items-center px-4 py-2 bg-white/50 hover:bg-white/80 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="glass rounded-2xl p-4 mb-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'all'
                  ? 'bg-[#0066FF] text-white shadow-md'
                  : 'bg-white/50 text-gray-700 hover:bg-white/80'
              }`}
            >
              All ({requests.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'bg-white/50 text-gray-700 hover:bg-white/80'
              }`}
            >
              Pending ({requests.filter(r => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'approved'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-white/50 text-gray-700 hover:bg-white/80'
              }`}
            >
              Approved ({requests.filter(r => r.status === 'approved').length})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === 'rejected'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-white/50 text-gray-700 hover:bg-white/80'
              }`}
            >
              Rejected ({requests.filter(r => r.status === 'rejected').length})
            </button>
          </div>
        </div>

        {/* Requests List */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          {filteredRequests.length > 0 ? (
            <div className="divide-y divide-gray-200/50">
              {filteredRequests.map((request) => (
                <div key={request.id} className="px-6 py-5 hover:bg-white/30 transition-all duration-200 group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                          <span className="text-[#0066FF] font-bold text-lg">
                            {request.username[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{request.username}</h3>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                            {request.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {request.userEmail}
                        </div>
                        {request.teamName && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Team: {request.teamName}
                          </div>
                        )}
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Requested: {formatDate(request.requestedAt)}
                        </div>
                        {request.reason && (
                          <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                            <p className="text-sm"><strong>Reason:</strong> {request.reason}</p>
                          </div>
                        )}
                        {request.adminNotes && (
                          <div className="mt-2 p-3 bg-gray-50/50 rounded-lg border border-gray-200">
                            <p className="text-sm"><strong>Admin Notes:</strong> {request.adminNotes}</p>
                          </div>
                        )}
                        {request.resetLink && request.status === 'approved' && (
                          <div className="mt-2 p-3 bg-green-50/50 rounded-lg border border-green-200">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-green-800">Reset Link Generated</p>
                              <button
                                onClick={() => {
                                  setGeneratedLink(request.resetLink!);
                                  setShowLinkModal(true);
                                }}
                                className="text-xs text-green-600 hover:text-green-800 underline"
                              >
                                View Link
                              </button>
                            </div>
                            {request.resetLinkExpiresAt && (
                              <p className="text-xs text-gray-600 mt-1">
                                Expires: {formatDate(request.resetLinkExpiresAt)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors text-sm font-medium"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm font-medium"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </button>
                        </>
                      )}
                      {request.status !== 'pending' && (
                        <button
                          onClick={() => handleDelete(request.id)}
                          className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors text-sm font-medium"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Requests Found</h3>
              <p className="text-gray-500">
                {filter === 'all' 
                  ? 'There are no password reset requests yet.'
                  : `There are no ${filter} password reset requests.`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reset Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowLinkModal(false)}>
          <div className="glass rounded-2xl p-6 max-w-2xl w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold gradient-text">Password Reset Link</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Copy and send this link to the user via a secure channel. The link will expire in 24 hours.
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 break-all font-mono text-sm">
              {generatedLink}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(generatedLink)}
                className="flex-1 px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Link
              </button>
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
