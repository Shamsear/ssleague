'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Hero from '@/components/home/Hero';
import Features from '@/components/home/Features';
import HowItWorks from '@/components/home/HowItWorks';
import CallToAction from '@/components/home/CallToAction';
import SmoothScroll from '@/components/home/SmoothScroll';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Get the appropriate dashboard URL based on user role
  const getDashboardUrl = (userRole: string) => {
    switch (userRole) {
      case 'super_admin':
        return '/dashboard/superadmin';
      case 'committee_admin':
        return '/dashboard/committee';
      case 'team':
        return '/dashboard/team';
      default:
        return '/dashboard';
    }
  };

  // Redirect authenticated users directly to their role-specific dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace(getDashboardUrl(user.role));
    }
  }, [user, loading, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <>
      <SmoothScroll />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </div>
    </>
  );
}
