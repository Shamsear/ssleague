'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PendingApproval() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="glass rounded-3xl shadow-xl backdrop-blur-md border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0066FF] to-[#9580FF] p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Account Pending Approval</h1>
            <p className="text-blue-100">Your registration has been successfully submitted!</p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Status Alert */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-xl p-6 mb-8">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-900 mb-1">⏳ Waiting for Super Admin Approval</h3>
                  <p className="text-yellow-800 text-sm">
                    Your account has been created but requires approval from a super admin before you can log in and access the platform.
                  </p>
                </div>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 text-[#0066FF] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                What Happens Next?
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start p-4 bg-white rounded-xl border border-gray-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center mr-4">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Super Admin Review</h3>
                    <p className="text-sm text-gray-600">A super admin will review your registration and verify your account details.</p>
                  </div>
                </div>

                <div className="flex items-start p-4 bg-white rounded-xl border border-gray-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center mr-4">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Account Approval</h3>
                    <p className="text-sm text-gray-600">Once approved, you'll be able to log in using your username and password.</p>
                  </div>
                </div>

                <div className="flex items-start p-4 bg-white rounded-xl border border-gray-200">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-semibold flex items-center justify-center mr-4">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Start Managing Your Team</h3>
                    <p className="text-sm text-gray-600">Access your dashboard, join seasons, participate in auctions, and build your dream team!</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-200 mb-8">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Important Notes
              </h3>
              <ul className="text-sm text-purple-800 space-y-2">
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  <span><strong>Cannot log in yet:</strong> You won't be able to access your account until it's approved</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  <span><strong>Timeline:</strong> Approval typically takes 24-48 hours</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  <span><strong>No notification:</strong> Try logging in after a day to check if you're approved</span>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-500 mr-2">•</span>
                  <span><strong>Questions?</strong> Contact the super admin if your approval is delayed</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/"
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#9580FF] text-white font-semibold text-center hover:shadow-lg transition-all duration-300"
              >
                Return to Home
              </Link>
              <Link
                href="/login"
                className="flex-1 py-3 px-6 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold text-center hover:bg-gray-50 transition-all duration-300"
              >
                Try Logging In
              </Link>
            </div>

            {/* Help Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Keep your username and password safe. You'll need them once your account is approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
