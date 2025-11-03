'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FinalizationStep {
  step_number: number;
  action: string;
  team_name: string;
  player_name: string;
  amount: number;
  timestamp: string;
}

interface FinalizationProgressProps {
  roundId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function FinalizationProgress({ 
  roundId, 
  onComplete, 
  onError 
}: FinalizationProgressProps) {
  const [status, setStatus] = useState<'initializing' | 'processing' | 'completed' | 'error'>('initializing');
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [steps, setSteps] = useState<FinalizationStep[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Prevent double finalization (React Strict Mode runs useEffect twice)
    if (hasStartedRef.current) {
      console.log('⚠️ Finalization already started, skipping duplicate call');
      return;
    }
    
    hasStartedRef.current = true;
    startFinalization();
  }, [roundId]);

  const startFinalization = async () => {
    try {
      setStatus('processing');
      setCurrentPhase('Phase 1: Processing Complete Teams');

      // Call finalization API
      const response = await fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (result.success) {
        // Finalization completed successfully
        setStatus('completed');
        setCurrentPhase('Finalization Complete');
        
        // Extract steps from allocations
        const allocationSteps: FinalizationStep[] = result.allocations?.map((alloc: any, index: number) => ({
          step_number: index + 1,
          action: alloc.phase === 'incomplete' 
            ? `📊 Allocated to incomplete team (average price)`
            : `✅ Allocated`,
          team_name: alloc.team_name,
          player_name: alloc.player_name,
          amount: alloc.amount,
          timestamp: new Date().toISOString(),
        })) || [];

        setSteps(allocationSteps);
        setSummary({
          total_allocations: result.allocations?.length || 0,
          message: result.message,
        });

        // Delay before calling onComplete to let user see final state
        setTimeout(() => onComplete(), 2000);
      } else if (result.tieDetected) {
        // Tie detected - show tie information
        setStatus('error');
        setCurrentPhase('Tiebreaker Required');
        
        const tieStep: FinalizationStep = {
          step_number: 1,
          action: `⚠️ Tie detected for ${result.tiedBids?.[0]?.player_name || 'player'}`,
          team_name: result.tiedBids?.map((b: any) => b.team_name).join(', ') || '',
          player_name: result.tiedBids?.[0]?.player_name || 'Unknown',
          amount: result.tiedBids?.[0]?.amount || 0,
          timestamp: new Date().toISOString(),
        };
        
        setSteps([tieStep]);
        onError(`Tie detected - tiebreaker created`);
      } else {
        setStatus('error');
        onError(result.error || 'Finalization failed');
      }
    } catch (error) {
      console.error('Finalization error:', error);
      setStatus('error');
      onError('Failed to finalize round');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`p-6 border-b ${
          status === 'completed' ? 'bg-green-50' : 
          status === 'error' ? 'bg-red-50' : 
          'bg-blue-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {status === 'initializing' && (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    Initializing...
                  </>
                )}
                {status === 'processing' && (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    Finalizing Round
                  </>
                )}
                {status === 'completed' && (
                  <>
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Finalization Complete
                  </>
                )}
                {status === 'error' && (
                  <>
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Action Required
                  </>
                )}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{currentPhase}</p>
            </div>
            
            {summary && (
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600">
                  {summary.total_allocations}
                </div>
                <div className="text-xs text-gray-500">Players Allocated</div>
              </div>
            )}
          </div>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-6">
          {steps.length === 0 && status === 'processing' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p>Processing allocations...</p>
            </div>
          )}

          {steps.length > 0 && (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-200 animate-slideIn"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                          {step.step_number}
                        </span>
                        <span className="text-sm text-gray-500">{step.action}</span>
                      </div>
                      
                      <div className="ml-8">
                        <div className="font-semibold text-gray-900">
                          {step.player_name}
                          <span className="mx-2 text-gray-400">→</span>
                          {step.team_name}
                        </div>
                        <div className="text-sm text-green-600 font-medium mt-1">
                          £{step.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'completed' && (
          <div className="p-6 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                ✅ All players successfully allocated
              </div>
              <button
                onClick={onComplete}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="p-6 border-t bg-red-50">
            <div className="text-sm text-red-600 mb-3">
              {steps[0]?.action || 'An error occurred during finalization'}
            </div>
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
