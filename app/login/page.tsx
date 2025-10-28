import { Suspense } from 'react';
import Login from '@/components/auth/Login';

export const metadata = {
  title: 'Login - SS League',
  description: 'Sign in to your SS League auction account',
};

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <Login />
    </Suspense>
  );
}
