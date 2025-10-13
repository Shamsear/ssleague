'use client';

import { useState } from 'react';
import { refreshAuthToken } from '@/lib/token-refresh';

interface TokenExpiredNotificationProps {
  onRefresh?: () => void;
}

export default function TokenExpiredNotification({ onRefresh }: TokenExpiredNotificationProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const token = await refreshAuthToken();
      
      if (token) {
        // Token refreshed successfully, reload the page or call callback
        if (onRefresh) {
          onRefresh();
        } else {
          window.location.reload();
        }
      } else {
        setError('Failed to refresh token. Please try logging in again.');
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl">
      <div className="flex items-start">
        <svg 
          className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
            clipRule="evenodd" 
          />
        </svg>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Session Expired</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Your session has expired. Please refresh your authentication to continue.
          </p>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
          <div className="mt-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <>
                  <svg 
                    className="animate-spin -ml-0.5 mr-2 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    ></circle>
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg 
                    className="-ml-0.5 mr-2 h-4 w-4" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                  Refresh Session
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
