'use client'

import { useEffect, useState } from 'react';

export default function Home() {
  const [progress, setProgress] = useState(0);

  // Force sign out from Firebase and clear user storage on mount
  useEffect(() => {
    const forceLogout = async () => {
      try {
        const { signOut } = await import('firebase/auth');
        const { auth } = await import('@/lib/firebase/config');
        if (auth) {
          await signOut(auth);
        }
      } catch (err) {
        console.error('Error during client-side force logout:', err);
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
      try {
        await fetch('/api/auth/clear-token', { method: 'POST' });
      } catch (e) {}
    };
    forceLogout();
  }, []);

  // Animate progress bar slightly for high fidelity look
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          clearInterval(timer);
          return 92; // Stay around 92% to represent "almost ready" loading state
        }
        return prev + 1;
      });
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] bg-[#F8FAFC] text-slate-800 flex flex-col items-center justify-center p-6 overflow-hidden font-sans select-none">
      {/* Background Decorative Soft Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-amber-100/40 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-orange-50/40 blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-yellow-50/50 blur-[100px] pointer-events-none"></div>

      {/* Subtle Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a03_1px,transparent_1px),linear-gradient(to_bottom,#0f172a03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none"></div>

      {/* Main Glassmorphic Card Container */}
      <main className="w-full max-w-lg bg-white/70 border border-slate-200/80 rounded-3xl p-8 md:p-12 shadow-[0_30px_70px_-15px_rgba(15,23,42,0.06)] backdrop-blur-2xl z-10 flex flex-col items-center text-center">
        {/* Animated Upgrade Status Tag */}
        <div className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200/50 text-xs font-semibold tracking-wider text-amber-700 uppercase mb-8">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
          System Upgrades In Progress
        </div>

        {/* Branding Logo (No Container) */}
        <img src="/logo.png" alt="SS League Logo" className="w-24 h-24 object-contain mb-6" />

        {/* Title */}
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-none mb-4">
          SS LEAGUE{' '}
          <span className="block mt-2 bg-clip-text text-transparent bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500">
            VERSION 2.0
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-500 text-sm md:text-base max-w-sm mb-8 leading-relaxed font-light font-normal">
          We are fully updating the UI/UX of SS League. Many features are currently being updated, refined, or removed to deliver a brand new, optimized experience.
        </p>

        {/* Loading Progress Component */}
        <div className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl p-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] w-full">
          <div className="flex items-center justify-between mb-2.5 text-xs font-semibold text-slate-600">
            <span>Updating core packages...</span>
            <span className="text-amber-600 font-mono">{progress}%</span>
          </div>

          {/* Bar track */}
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(245,158,11,0.3)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </main>

      {/* Copyright branding */}
      <footer className="absolute bottom-6 z-10">
        <p className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold">
          © 2026 SS League. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
