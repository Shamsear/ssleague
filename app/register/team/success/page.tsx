'use client'

import { useRouter } from 'next/navigation'

export default function TeamRegistrationSuccess() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full">
        {/* Success Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-green-400 to-green-600">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h2 className="text-3xl font-bold text-gray-800 mb-3 text-center">Registration Complete!</h2>
        <p className="text-gray-600 text-center mb-8">
          Your team registration has been successfully submitted. You will receive a confirmation email shortly with further instructions.
        </p>

        {/* Next Steps */}
        <div className="bg-gradient-to-br from-[#0066FF]/10 to-[#00D4FF]/10 rounded-2xl p-6 mb-8 border border-[#0066FF]/20">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">What's Next?</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <svg className="w-5 h-5 text-[#0066FF] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check your email for registration confirmation
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-[#0066FF] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Wait for approval from the season committee
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-[#0066FF] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              You'll receive login credentials to manage your team
            </li>
            <li className="flex items-start">
              <svg className="w-5 h-5 text-[#0066FF] mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Register your players once your team is approved
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <button
          onClick={() => router.push('/')}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white font-medium hover:shadow-lg transition-all"
        >
          Return Home
        </button>

        {/* Contact Info */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Questions? Contact the season committee for assistance.
        </p>
      </div>
    </div>
  )
}
