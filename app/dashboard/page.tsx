'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Route to role-specific dashboard
    if (!loading && user) {
      switch (user.role) {
        case 'super_admin':
          router.push('/dashboard/superadmin');
          break;
        case 'committee_admin':
          router.push('/dashboard/committee');
          break;
        case 'team':
          router.push('/dashboard/team');
          break;
        default:
          // Stay on this page if role is unknown
          break;
      }
    }
  }, [user, loading, router]);

  // Show loading while redirecting
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // If no user and not loading, return null (will redirect to login)
  return null;
}
