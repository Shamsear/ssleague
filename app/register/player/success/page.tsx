'use client'

import { useRouter } from 'next/navigation'

export default function PlayerRegistrationSuccess() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-2xl w-full">
        {/* Success Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-green-400 to-green-600">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h2 className="text-3xl font-bold text-gray-800 mb-3 text-center">Registration Successful!</h2>
        <p className="text-gray-600 text-center mb-8">
          Your player registration has been successfully submitted. The committee admins will review your registration shortly.
        </p>

        {/* Next Steps */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 mb-8 border border-green-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            What Happens Next?
          </h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm mr-3">1</div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Committee Review</h4>
                <p className="text-sm text-gray-600">Your registration will be reviewed and approved by the committee admins</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm mr-3">2</div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Team Assignment</h4>
                <p className="text-sm text-gray-600">You'll be assigned to a team and notified via email</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm mr-3">3</div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">Season Start</h4>
                <p className="text-sm text-gray-600">Watch for season schedule and match details</p>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Important Reminder</p>
              <p>Keep an eye on your email for updates from the committee. If you don't receive confirmation within 48 hours, please contact the committee admins.</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white font-medium hover:shadow-lg transition-all"
        >
          <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Return Home
        </button>

        {/* Contact Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Need assistance? Contact the committee admins
          </p>
        </div>
      </div>
    </div>
  )
}
