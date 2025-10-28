'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface NewsItem {
  id: string
  title: string
  content: string
  summary?: string
  category: string
  event_type: string
  season_id?: string
  season_name?: string
  created_at: string
  published_at?: string
  generated_by: 'ai' | 'admin'
  image_url?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  registration: 'bg-purple-100 text-purple-800',
  team: 'bg-blue-100 text-blue-800',
  auction: 'bg-orange-100 text-orange-800',
  fantasy: 'bg-green-100 text-green-800',
  match: 'bg-red-100 text-red-800',
  announcement: 'bg-gray-100 text-gray-800',
  milestone: 'bg-yellow-100 text-yellow-800',
}

const CATEGORY_ICONS: Record<string, string> = {
  registration: '👥',
  team: '🏆',
  auction: '💰',
  fantasy: '🎮',
  match: '⚽',
  announcement: '📢',
  milestone: '🎯',
}

export default function NewsPage() {
  const searchParams = useSearchParams()
  const seasonFilter = searchParams?.get('season')
  const categoryFilter = searchParams?.get('category')

  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryFilter)
  const [selectedSeason, setSelectedSeason] = useState<string | null>(seasonFilter)

  useEffect(() => {
    fetchNews()
  }, [selectedCategory, selectedSeason])

  const fetchNews = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.append('limit', '100')
      
      if (selectedCategory) {
        params.append('category', selectedCategory)
      }
      
      if (selectedSeason) {
        params.append('season_id', selectedSeason)
      }

      const response = await fetch(`/api/news?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch news')
      }

      const data = await response.json()
      setNews(data.news || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchNews}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <span className="text-4xl">📰</span>
            Tournament News & Updates
          </h1>
          <p className="text-gray-600">Stay updated with the latest happenings in SS Premier Super League</p>
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-medium transition-all ${
              !selectedCategory
                ? 'bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
            }`}
          >
            All News
          </button>
          {Object.keys(CATEGORY_COLORS).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white shadow-lg'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              <span>{CATEGORY_ICONS[category]}</span>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* News List */}
        {news.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-lg">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No news yet</h3>
            <p className="text-gray-600">Check back soon for exciting tournament updates!</p>
          </div>
        ) : (
          <div>
            {/* Featured Article (Latest) */}
            {news[0] && (
              <a
                href={`/news/${news[0].id}`}
                className="block mb-8 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all overflow-hidden border border-gray-100 group"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  {/* Featured Image */}
                  {news[0].image_url && (
                    <div className="h-96 lg:h-full overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
                      <img
                        src={news[0].image_url}
                        alt={news[0].title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="eager"
                      />
                    </div>
                  )}
                  <div className="p-8 lg:p-10 flex flex-col justify-center">
                    {/* Category & Date */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${CATEGORY_COLORS[news[0].category] || 'bg-gray-100 text-gray-800'}`}>
                        <span className="text-base">{CATEGORY_ICONS[news[0].category]}</span>
                        {news[0].category.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(news[0].published_at || news[0].created_at)}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-blue-600 transition-colors">
                      {news[0].title}
                    </h2>

                    {/* Summary */}
                    <p className="text-gray-700 text-lg leading-relaxed mb-6 line-clamp-3">
                      {news[0].summary || news[0].content.substring(0, 200) + '...'}
                    </p>

                    {/* Read More */}
                    <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                      <span>Read Full Story</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            )}

            {/* Other News Grid */}
            {news.length > 1 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <span>More News</span>
                  <div className="h-1 flex-1 bg-gradient-to-r from-blue-500 to-transparent rounded"></div>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {news.slice(1).map((item) => (
                    <a
                      key={item.id}
                      href={`/news/${item.id}`}
                      className="block bg-white rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100 group"
                    >
                      {/* Image */}
                      {item.image_url && (
                        <div className="h-48 overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-5">
                        {/* Category & Date */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-800'}`}>
                            <span>{CATEGORY_ICONS[item.category]}</span>
                            {item.category.toUpperCase()}
                          </span>
                          <time className="text-xs text-gray-500">
                            {formatDate(item.published_at || item.created_at).split(',')[0]}
                          </time>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                          {item.title}
                        </h3>

                        {/* Summary */}
                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                          {item.summary || item.content.substring(0, 120) + '...'}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
