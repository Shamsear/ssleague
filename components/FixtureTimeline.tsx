'use client';

import { useEffect, useState } from 'react';

interface TimelineEvent {
  id: string | number;
  type: string;
  action: string;
  user: string;
  user_id?: string;
  timestamp: string;
  icon: string;
  color: string;
  details: string;
  changes?: any;
  notes?: string;
}

interface FixtureTimelineProps {
  fixtureId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function FixtureTimeline({ fixtureId, isOpen, onClose }: FixtureTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [fixture, setFixture] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fixtureId) {
      fetchTimeline();
    }
  }, [isOpen, fixtureId]);

  const fetchTimeline = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/audit-log`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }

      const data = await response.json();
      setTimeline(data.timeline || []);
      setFixture(data.fixture);
    } catch (err: any) {
      console.error('Error fetching timeline:', err);
      setError(err.message || 'Failed to load timeline');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'green':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'orange':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'red':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'purple':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Fixture Timeline
            </h2>
            {fixture && (
              <p className="text-sm text-white/80 mt-1">
                {fixture.home_team} vs {fixture.away_team} • Round {fixture.round_number}, Match {fixture.match_number}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading timeline...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={fetchTimeline}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-600">No timeline events found</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 via-blue-300 to-purple-300"></div>

              {/* Timeline events */}
              <div className="space-y-6">
                {timeline.map((event, index) => (
                  <div key={event.id} className="relative pl-16">
                    {/* Icon */}
                    <div className={`absolute left-0 w-12 h-12 rounded-full border-4 border-white flex items-center justify-center text-2xl shadow-lg ${getColorClasses(event.color)}`}>
                      {event.icon}
                    </div>

                    {/* Event card */}
                    <div className="bg-white border-2 border-gray-100 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900 text-lg">{event.action}</h3>
                          <p className="text-sm text-gray-600">
                            by <span className="font-semibold text-purple-600">{event.user}</span>
                          </p>
                        </div>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {event.details && (
                        <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded-lg">
                          {event.details}
                        </p>
                      )}

                      {event.notes && (
                        <div className="mt-2 text-xs text-gray-600 italic bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded">
                          <strong>Note:</strong> {event.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {timeline.length > 0 ? (
              <>
                <strong>{timeline.length}</strong> event{timeline.length !== 1 ? 's' : ''} recorded
              </>
            ) : (
              'No events yet'
            )}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
