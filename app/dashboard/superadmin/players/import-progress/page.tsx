'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ImportStep {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

interface ImportProgress {
  status: 'running' | 'completed' | 'failed';
  overall_progress: number;
  current_step: number;
  steps: ImportStep[];
  summary?: {
    new_players_created: number;
    existing_players_updated: number;
    total_operations: number;
    total_processed: number;
  };
}

export default function PlayersImportProgress() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const importId = searchParams.get('id');

  const [progress, setProgress] = useState<ImportProgress>({
    status: 'running',
    overall_progress: 0,
    current_step: 0,
    steps: [
      { name: 'Initializing Import', description: 'Preparing player import process', status: 'running', progress: 0 },
      { name: 'Validating Data', description: 'Checking player data integrity', status: 'pending', progress: 0 },
      { name: 'Creating Players', description: 'Adding new players to database', status: 'pending', progress: 0 },
      { name: 'Updating Players', description: 'Updating existing player records', status: 'pending', progress: 0 },
      { name: 'Finalizing', description: 'Completing import and cleanup', status: 'pending', progress: 0 },
    ],
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Simulate progress updates - Replace with actual Server-Sent Events or WebSocket
  useEffect(() => {
    if (!importId) return;

    let currentStep = 0;
    const interval = setInterval(() => {
      setProgress(prev => {
        const newSteps = [...prev.steps];
        const step = newSteps[currentStep];

        if (step) {
          // Update current step progress
          if (step.progress < 100) {
            step.progress = Math.min(step.progress + 20, 100);
            step.status = 'running';
            step.message = `Processing... ${step.progress}%`;
          } else if (step.progress === 100 && step.status === 'running') {
            step.status = 'completed';
            step.message = 'Completed successfully';
            currentStep++;
            
            // Start next step
            if (currentStep < newSteps.length) {
              newSteps[currentStep].status = 'running';
              newSteps[currentStep].progress = 0;
            }
          }
        }

        const completedSteps = newSteps.filter(s => s.status === 'completed').length;
        const overallProgress = Math.round((completedSteps / newSteps.length) * 100);
        const allCompleted = completedSteps === newSteps.length;

        return {
          ...prev,
          steps: newSteps,
          overall_progress: overallProgress,
          current_step: currentStep,
          status: allCompleted ? 'completed' : 'running',
          summary: allCompleted ? {
            new_players_created: 45,
            existing_players_updated: 23,
            total_operations: 68,
            total_processed: 68,
          } : undefined,
        };
      });
    }, 800);

    return () => clearInterval(interval);
  }, [importId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-6 h-6 rounded-full bg-gray-300"></div>;
      case 'running':
        return <div className="w-6 h-6 rounded-full bg-blue-500 animate-pulse"></div>;
      case 'completed':
        return (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStepBorderClass = (status: string) => {
    switch (status) {
      case 'running':
        return 'border-blue-200 bg-blue-50';
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (!importId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No import ID provided</p>
          <button
            onClick={() => router.push('/dashboard/superadmin/players')}
            className="mt-4 px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0066FF]/90"
          >
            Return to Players
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">👥 Player Import in Progress</h1>
              <p className="text-gray-600 text-sm md:text-base">Importing players from Excel to database</p>
            </div>
            <div className="flex items-center">
              <div className={`flex items-center px-3 py-2 rounded-lg ${getStatusColor(progress.status)}`}>
                {progress.status === 'running' && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span className="font-medium">
                  {progress.status === 'running' && 'Processing...'}
                  {progress.status === 'completed' && 'Completed!'}
                  {progress.status === 'failed' && 'Failed'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-gray-800">Overall Progress</h2>
              <span className="text-2xl font-bold text-[#0066FF]">{progress.overall_progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 h-4 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress.overall_progress}%` }}
              ></div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {progress.steps[progress.current_step] && (
              <>
                <span className="font-medium">{progress.steps[progress.current_step].name}</span>
                {progress.steps[progress.current_step].message && (
                  <span className="block text-xs text-gray-500 mt-1">
                    {progress.steps[progress.current_step].message}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detailed Steps */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          <div className="px-6 py-5 bg-gradient-to-r from-[#0066FF]/5 to-[#0066FF]/10 border-b border-[#0066FF]/20">
            <h3 className="text-xl font-semibold text-[#0066FF] flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              Player Import Steps
            </h3>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {progress.steps.map((step, index) => (
                <div key={index} className={`flex items-center p-4 rounded-lg border ${getStepBorderClass(step.status)}`}>
                  <div className="flex-shrink-0 mr-4">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-grow">
                    <h4 className={`font-medium ${step.status === 'running' ? 'text-blue-800' : step.status === 'completed' ? 'text-green-800' : step.status === 'failed' ? 'text-red-800' : 'text-gray-600'}`}>
                      {step.name}
                    </h4>
                    <p className="text-sm text-gray-600">{step.description}</p>
                    {step.message && (
                      <p className="text-xs text-gray-500 mt-1">{step.message}</p>
                    )}
                    {step.error && (
                      <p className="text-xs text-red-600 mt-1">Error: {step.error}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {step.status === 'running' && step.progress > 0 && (
                      <div className="w-16">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${step.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Import Summary */}
        {progress.summary && progress.status === 'completed' && (
          <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Import Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="text-2xl font-bold text-green-600">{progress.summary.new_players_created}</div>
                <div className="text-sm text-gray-600">New Players</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{progress.summary.existing_players_updated}</div>
                <div className="text-sm text-gray-600">Updated Players</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{progress.summary.total_operations}</div>
                <div className="text-sm text-gray-600">Total Operations</div>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                <div className="text-2xl font-bold text-indigo-600">{progress.summary.total_processed}</div>
                <div className="text-sm text-gray-600">Players Processed</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        {progress.status === 'completed' && (
          <div className="flex justify-center">
            <button
              onClick={() => router.push('/dashboard/superadmin/players')}
              className="inline-flex items-center px-6 py-3 bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-medium rounded-lg transition-colors shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              View Results
            </button>
          </div>
        )}

        {progress.status === 'failed' && (
          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard/superadmin/players')}
              className="inline-flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Players
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-6 py-3 bg-[#0066FF] hover:bg-[#0066FF]/90 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
