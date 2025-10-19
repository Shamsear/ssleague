'use client'

import { useState, useEffect } from 'react'

interface EmailVerificationRequest {
  id: string
  player_id: string
  season_id: string
  email: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  player_name?: string
}

interface EmailVerificationRequestsProps {
  seasonId: string
}

export default function EmailVerificationRequests({ seasonId }: EmailVerificationRequestsProps) {
  const [requests, setRequests] = useState<EmailVerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [seasonId])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/telegram/email-requests?seasonId=${seasonId}`)
      const data = await response.json()
      
      if (response.ok) {
        // Filter only pending requests
        const pendingRequests = data.requests.filter((r: EmailVerificationRequest) => r.status === 'pending')
        setRequests(pendingRequests)
      } else {
        setError(data.error || 'Failed to load verification requests')
      }
    } catch (err) {
      console.error('Error fetching verification requests:', err)
      setError('Failed to load verification requests')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/telegram/email-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess(data.message)
        fetchRequests() // Refresh list
      } else {
        setError(data.error || 'Failed to approve request')
      }
    } catch (err) {
      console.error('Error approving request:', err)
      setError('Failed to approve request')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setProcessing(requestId)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/telegram/email-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccess(data.message)
        fetchRequests() // Refresh list
      } else {
        setError(data.error || 'Failed to reject request')
      }
    } catch (err) {
      console.error('Error rejecting request:', err)
      setError('Failed to reject request')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email Verification Requests
        </h3>
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (requests.length === 0) {
    return null // Don't show section if no requests
  }

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Email Verification Requests ({requests.length} pending)
      </h3>

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">{request.player_name}</h4>
                <p className="text-sm text-gray-600">Player ID: {request.player_id}</p>
                <p className="text-sm text-gray-600">Email: {request.email}</p>
                {request.reason && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Reason:</strong> {request.reason}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Submitted: {new Date(request.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(request.id)}
                disabled={processing === request.id}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {processing === request.id ? 'Processing...' : '✓ Approve & Register'}
              </button>
              <button
                onClick={() => handleReject(request.id)}
                disabled={processing === request.id}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {processing === request.id ? 'Processing...' : '✗ Reject'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
