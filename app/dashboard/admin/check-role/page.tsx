'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function CheckRolePage() {
  const { user, loading, firebaseUser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            🔍 User Role Check
          </h1>
          <p className="text-gray-600">
            Diagnostic page to check your current user role and permissions
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Authentication Status</h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="w-48 font-semibold text-gray-700">Firebase User:</div>
              <div className="flex-1">
                {firebaseUser ? (
                  <span className="text-green-600">✅ Authenticated</span>
                ) : (
                  <span className="text-red-600">❌ Not authenticated</span>
                )}
              </div>
            </div>

            {firebaseUser && (
              <>
                <div className="flex items-start">
                  <div className="w-48 font-semibold text-gray-700">Email:</div>
                  <div className="flex-1 text-gray-900">{firebaseUser.email}</div>
                </div>

                <div className="flex items-start">
                  <div className="w-48 font-semibold text-gray-700">UID:</div>
                  <div className="flex-1 text-gray-900 font-mono text-sm">{firebaseUser.uid}</div>
                </div>
              </>
            )}

            <div className="flex items-start">
              <div className="w-48 font-semibold text-gray-700">User Document:</div>
              <div className="flex-1">
                {user ? (
                  <span className="text-green-600">✅ Loaded</span>
                ) : (
                  <span className="text-red-600">❌ Not loaded</span>
                )}
              </div>
            </div>

            {user && (
              <>
                <div className="flex items-start">
                  <div className="w-48 font-semibold text-gray-700">Username:</div>
                  <div className="flex-1 text-gray-900">{user.username}</div>
                </div>

                <div className="flex items-start">
                  <div className="w-48 font-semibold text-gray-700">Role:</div>
                  <div className="flex-1">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                      user.role === 'committee_admin' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-48 font-semibold text-gray-700">Is Active:</div>
                  <div className="flex-1">
                    {user.isActive ? (
                      <span className="text-green-600">✅ Yes</span>
                    ) : (
                      <span className="text-red-600">❌ No</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-48 font-semibold text-gray-700">Is Approved:</div>
                  <div className="flex-1">
                    {user.isApproved ? (
                      <span className="text-green-600">✅ Yes</span>
                    ) : (
                      <span className="text-red-600">❌ No</span>
                    )}
                  </div>
                </div>

                {user.role === 'committee_admin' && 'seasonId' in user && (
                  <div className="flex items-start">
                    <div className="w-48 font-semibold text-gray-700">Season ID:</div>
                    <div className="flex-1 text-gray-900">{user.seasonId}</div>
                  </div>
                )}

                {user.role === 'team' && 'teamName' in user && (
                  <div className="flex items-start">
                    <div className="w-48 font-semibold text-gray-700">Team Name:</div>
                    <div className="flex-1 text-gray-900">{user.teamName}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Access Check</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">Can access Season Carryover page?</span>
              {user?.role === 'super_admin' ? (
                <span className="text-green-600 font-semibold">✅ Yes</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ No (requires super_admin role)</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">Can access Awards Order page?</span>
              {user?.role === 'super_admin' ? (
                <span className="text-green-600 font-semibold">✅ Yes</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ No (requires super_admin role)</span>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-700">Can access Committee pages?</span>
              {user?.role === 'committee_admin' || user?.role === 'super_admin' ? (
                <span className="text-green-600 font-semibold">✅ Yes</span>
              ) : (
                <span className="text-red-600 font-semibold">❌ No (requires committee_admin or super_admin role)</span>
              )}
            </div>
          </div>
        </div>

        {user?.role !== 'super_admin' && (
          <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
            <p className="text-yellow-800">
              <strong>Note:</strong> You need the <code className="bg-yellow-100 px-2 py-1 rounded">super_admin</code> role to access admin pages like Season Carryover. 
              Please contact a super admin to update your role in the Firebase users collection.
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
          <p className="text-blue-800 mb-2">
            <strong>Raw User Data (for debugging):</strong>
          </p>
          <pre className="bg-white p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
