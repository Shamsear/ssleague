interface ContractInfoProps {
  skippedSeasons?: number;
  penaltyAmount?: number;
  lastPlayedSeason?: string;
  contractId?: string;
  contractStartSeason?: string;
  contractEndSeason?: string;
  isAutoRegistered?: boolean;
  compact?: boolean;
}

export default function ContractInfo({
  skippedSeasons = 0,
  penaltyAmount = 0,
  lastPlayedSeason,
  contractId,
  contractStartSeason,
  contractEndSeason,
  isAutoRegistered = false,
  compact = false
}: ContractInfoProps) {
  // Don't show anything if no relevant data
  if (!contractId && !skippedSeasons && !penaltyAmount) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 text-xs">
        {/* Contract Badge */}
        {contractId && (
          <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${
            isAutoRegistered 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {isAutoRegistered ? '🔄 Auto-registered' : '✓ 2-Season Contract'}
          </span>
        )}

        {/* Penalty Badge */}
        {penaltyAmount > 0 && (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-800 font-medium">
            ⚠️ Penalty: €{penaltyAmount}
          </span>
        )}

        {/* Skipped Seasons Badge */}
        {skippedSeasons > 0 && (
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800 font-medium">
            Skipped {skippedSeasons} season{skippedSeasons > 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
      <div className="flex items-start space-x-3">
        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Contract Information</h4>
          
          {/* Contract Status */}
          {contractId && (
            <div className="mb-2">
              {isAutoRegistered ? (
                <div className="flex items-center text-sm text-blue-800">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Auto-registered (2-season contract)</span>
                </div>
              ) : (
                <div className="flex items-center text-sm text-green-800">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>2-Season Contract Active</span>
                </div>
              )}
              {contractStartSeason && contractEndSeason && (
                <div className="text-xs text-gray-600 ml-5">
                  S{contractStartSeason.replace(/\D/g, '')} - S{contractEndSeason.replace(/\D/g, '')}
                </div>
              )}
            </div>
          )}

          {/* Penalty Warning */}
          {penaltyAmount > 0 && (
            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r mb-2">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    Contract Breach Penalty: €{penaltyAmount.toLocaleString()}
                  </p>
                  {skippedSeasons > 0 && (
                    <p className="text-xs text-red-700 mt-1">
                      Skipped {skippedSeasons} season{skippedSeasons > 1 ? 's' : ''} (€500 per season)
                    </p>
                  )}
                  {lastPlayedSeason && (
                    <p className="text-xs text-red-700 mt-1">
                      Last played: Season {lastPlayedSeason.replace(/\D/g, '')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Budget Note */}
          {(penaltyAmount > 0 || contractId) && (
            <div className="text-xs text-gray-600 italic">
              {penaltyAmount > 0 
                ? '💰 Budget reflects last season ending balance minus penalty'
                : '💰 Budget will carry forward to next season plus bonuses/penalties'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
