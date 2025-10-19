'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordRequest() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Call API to create password reset request
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          reason: reason.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess(true);
    } catch (error) {
      console.error('Error requesting password reset:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit request';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="glass rounded-3xl p-8 shadow-xl backdrop-blur-md border border-white/20 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-4">Request Submitted</h2>
            <p className="text-gray-600 mb-6">
              Your password reset request has been submitted successfully. A super admin will review your request and provide a password reset link if approved.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              You will receive further instructions once your request is reviewed.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors"
            >
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="glass rounded-3xl p-8 shadow-xl backdrop-blur-md border border-white/20">
          <div className="mb-6">
            <h2 className="text-3xl font-bold gradient-text text-center mb-2">
              Request Password Reset
            </h2>
            <p className="text-center text-gray-600 text-sm">
              Submit a request to reset your password. A super admin will review and approve your request.
            </p>
          </div>

          {/* Info Alert */}
          <div className="bg-blue-50/50 rounded-lg p-4 mb-6 border border-blue-100">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> For security reasons, password resets require super admin approval. Once approved, you will receive a password reset link.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={submitting}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter your username"
              />
            </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Password Reset (Optional)
                </label>
                <textarea
                  id="reason"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={submitting}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Please explain why you need to reset your password (e.g., forgot password, security concern, etc.)"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Submit Request
                  </>
                )}
              </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-[#0066FF] hover:underline"
              >
                Remember your password? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
