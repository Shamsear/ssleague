'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function HeroSection() {
  const { user, loading } = useAuth();

  const getDashboardUrl = (userRole: string) => {
    switch (userRole) {
      case 'super_admin': return '/dashboard/superadmin';
      case 'committee_admin': return '/dashboard/committee';
      case 'team': return '/dashboard/team';
      default: return '/dashboard';
    }
  };

  if (loading) {
    return (
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 gradient-text">
          Welcome to SS League
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Experience the thrill of building your dream football team through strategic bidding and competitive auctions
        </p>
        <div className="h-12 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center mb-12">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 gradient-text">
        Welcome to SS League
      </h1>
      <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        Experience the thrill of building your dream football team through strategic bidding and competitive auctions
      </p>

      {user ? (
        <Link
          href={getDashboardUrl(user.role)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          Go to Dashboard
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      ) : (
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          Login
        </Link>
      )}
    </div>
  );
}
