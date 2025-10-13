'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getReadStats, logReadStats, resetReadCount } from '@/utils/readCounter'
import { getCacheStatistics, invalidateAllCaches, invalidatePlayerCaches, invalidateTeamCaches } from '@/utils/smartCache'
import { getCacheInfo } from '@/utils/cache'

export default function MonitoringPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [readStats, setReadStats] = useState(getReadStats())
  const [cacheStats, setCacheStats] = useState(getCacheStatistics())
  const [cacheInfo, setCacheInfo] = useState(getCacheInfo())
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'super_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    // Refresh stats every 5 seconds
    const interval = setInterval(() => {
      setReadStats(getReadStats())
      setCacheStats(getCacheStatistics())
      setCacheInfo(getCacheInfo())
    }, 5000)

    setRefreshInterval(interval)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  const handleResetReads = () => {
    if (confirm('Reset read counter? This is for testing only.')) {
      resetReadCount()
      setReadStats(getReadStats())
    }
  }

  const handleClearAllCaches = () => {
    if (confirm('Clear all caches? Users will need to refetch data.')) {
      invalidateAllCaches()
      setCacheStats(getCacheStatistics())
      setCacheInfo(getCacheInfo())
    }
  }

  const handleClearPlayerCaches = () => {
    invalidatePlayerCaches()
    setCacheStats(getCacheStatistics())
    setCacheInfo(getCacheInfo())
  }

  const handleClearTeamCaches = () => {
    invalidateTeamCaches()
    setCacheStats(getCacheStatistics())
    setCacheInfo(getCacheInfo())
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatAge = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`
    return `${seconds}s ago`
  }

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-orange-500'
    if (percentage >= 60) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusText = (percentage: number) => {
    if (percentage >= 100) return 'Over Limit'
    if (percentage >= 80) return 'Critical'
    if (percentage >= 60) return 'Warning'
    return 'Good'
  }

  if (authLoading || !user || user.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">📊 System Monitoring</h1>
            <p className="text-gray-600 text-sm md:text-base">Firestore reads, cache performance, and optimization insights</p>
          </div>
          <Link
            href="/dashboard/superadmin"
            className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Read Statistics */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">🔥 Firestore Reads</h2>
          <button
            onClick={handleResetReads}
            className="text-sm px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            Reset Counter
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Daily Usage</span>
            <span className="text-sm font-bold text-gray-900">
              {readStats.current.toLocaleString()} / {readStats.limit.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 ${getStatusColor(readStats.percentage)} transition-all duration-500`}
              style={{ width: `${Math.min(100, readStats.percentage)}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className={`text-sm font-semibold ${
              readStats.isOverLimit ? 'text-red-600' : 
              readStats.isNearLimit ? 'text-orange-600' : 
              'text-green-600'
            }`}>
              {getStatusText(readStats.percentage)}
            </span>
            <span className="text-sm text-gray-600">
              {readStats.remaining.toLocaleString()} reads remaining
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
            <div className="text-xs text-blue-600 font-semibold mb-1">CURRENT READS</div>
            <div className="text-2xl font-bold text-blue-900">{readStats.current.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
            <div className="text-xs text-green-600 font-semibold mb-1">REMAINING</div>
            <div className="text-2xl font-bold text-green-900">{readStats.remaining.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
            <div className="text-xs text-purple-600 font-semibold mb-1">PERCENTAGE</div>
            <div className="text-2xl font-bold text-purple-900">{readStats.percentage.toFixed(1)}%</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
            <div className="text-xs text-orange-600 font-semibold mb-1">DAILY LIMIT</div>
            <div className="text-2xl font-bold text-orange-900">{readStats.limit.toLocaleString()}</div>
          </div>
        </div>

        {/* Status Messages */}
        {readStats.isOverLimit && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-800">Daily Limit Exceeded</h3>
                <p className="text-xs text-red-700 mt-1">
                  You've exceeded your daily read quota. Consider upgrading to Blaze plan or optimize your queries.
                </p>
              </div>
            </div>
          </div>
        )}
        {readStats.isNearLimit && !readStats.isOverLimit && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-yellow-800">Approaching Limit</h3>
                <p className="text-xs text-yellow-700 mt-1">
                  You're approaching your daily read quota. Monitor your usage carefully.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cache Statistics */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">💾 Cache Performance</h2>
          <button
            onClick={handleClearAllCaches}
            className="text-sm px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors"
          >
            Clear All Caches
          </button>
        </div>

        {/* Cache Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-xs text-blue-600 font-semibold mb-1">TOTAL</div>
            <div className="text-2xl font-bold text-blue-900">{cacheStats.totalCaches}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-xs text-green-600 font-semibold mb-1">PLAYERS</div>
            <div className="text-2xl font-bold text-green-900">{cacheStats.playerCaches}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-xs text-purple-600 font-semibold mb-1">TEAMS</div>
            <div className="text-2xl font-bold text-purple-900">{cacheStats.teamCaches}</div>
          </div>
          <div className="bg-pink-50 p-4 rounded-lg text-center">
            <div className="text-xs text-pink-600 font-semibold mb-1">SEASONS</div>
            <div className="text-2xl font-bold text-pink-900">{cacheStats.seasonCaches}</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg text-center">
            <div className="text-xs text-indigo-600 font-semibold mb-1">INVITES</div>
            <div className="text-2xl font-bold text-indigo-900">{cacheStats.inviteCaches}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <div className="text-xs text-yellow-600 font-semibold mb-1">USERS</div>
            <div className="text-2xl font-bold text-yellow-900">{cacheStats.userCaches}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <div className="text-xs text-gray-600 font-semibold mb-1">AGG</div>
            <div className="text-2xl font-bold text-gray-900">{cacheStats.aggregationCaches}</div>
          </div>
        </div>

        {/* Cache Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Storage</div>
            <div className="text-xl font-bold text-gray-900">{formatBytes(cacheStats.totalSize)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Oldest Cache</div>
            <div className="text-xl font-bold text-gray-900">
              {cacheStats.oldestCache ? formatAge(cacheStats.oldestCache.age) : 'N/A'}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Newest Cache</div>
            <div className="text-xl font-bold text-gray-900">
              {cacheStats.newestCache ? formatAge(cacheStats.newestCache.age) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Cache Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleClearPlayerCaches}
            className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors text-sm font-medium"
          >
            Clear Player Caches
          </button>
          <button
            onClick={handleClearTeamCaches}
            className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors text-sm font-medium"
          >
            Clear Team Caches
          </button>
        </div>
      </div>

      {/* Recommendations */}
      <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">💡 Optimization Recommendations</h2>
        
        <div className="space-y-4">
          {readStats.percentage > 80 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">⚠️ High Read Usage</h3>
              <p className="text-sm text-red-700 mb-2">Your read usage is very high. Consider:</p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                <li>Upgrading to Blaze plan for higher quota</li>
                <li>Implementing pagination on all player lists</li>
                <li>Increasing cache duration from 1 hour to 2 hours</li>
                <li>Using aggregation documents for counts</li>
              </ul>
            </div>
          )}

          {cacheStats.totalCaches === 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-800 mb-2">📦 No Active Caches</h3>
              <p className="text-sm text-yellow-700">
                Caching is not being utilized. Make sure pages are implementing the caching utilities.
              </p>
            </div>
          )}

          {cacheStats.oldestCache && cacheStats.oldestCache.age > 2 * 60 * 60 * 1000 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">🕐 Old Cache Detected</h3>
              <p className="text-sm text-blue-700">
                Some caches are older than 2 hours. Consider clearing them to ensure users see fresh data.
              </p>
            </div>
          )}

          {readStats.percentage < 50 && cacheStats.totalCaches > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">✅ System Running Well</h3>
              <p className="text-sm text-green-700">
                Your read usage is low and caching is active. System is optimized!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
