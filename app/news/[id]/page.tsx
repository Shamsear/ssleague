'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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

export default function NewsArticlePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [news, setNews] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchNewsItem()
    }
  }, [id])

  const fetchNewsItem = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/news?include_drafts=false&limit=100`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch news')
      }

      const data = await response.json()
      const item = data.news?.find((n: NewsItem) => n.id === id)

      if (!item) {
        setError('News article not found')
      } else {
        setNews(item)
      }
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-96 bg-gray-200 rounded-2xl mb-8"></div>
            <div className="h-12 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !news) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-bold text-red-800 mb-2">Article Not Found</h2>
            <p className="text-red-600 mb-6">{error || 'The news article you\'re looking for doesn\'t exist or has been removed.'}</p>
            <Link
              href="/news"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to News
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to all news
        </Link>

        {/* Article Container */}
        <article className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Featured Image */}
          {news.image_url && (
            <div className="w-full h-96 overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
              <img
                src={news.image_url}
                alt={news.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-8 lg:p-12">
            {/* Category & Date */}
            <div className="flex items-center gap-4 mb-6">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${CATEGORY_COLORS[news.category] || 'bg-gray-100 text-gray-800'}`}>
                <span className="text-lg">{CATEGORY_ICONS[news.category]}</span>
                {news.category.toUpperCase()}
              </span>
              <time className="text-gray-500 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDate(news.published_at || news.created_at)}
              </time>
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {news.title}
            </h1>

            {/* Summary */}
            {news.summary && (
              <p className="text-xl text-gray-700 leading-relaxed mb-8 pb-8 border-b border-gray-200 font-medium">
                {news.summary}
              </p>
            )}

            {/* Full Content */}
            <div className="prose prose-lg max-w-none">
              <div className="text-gray-800 leading-relaxed whitespace-pre-line text-lg">
                {news.content}
              </div>
            </div>

            {/* Season Tag */}
            {news.season_name && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span className="font-semibold text-gray-900">{news.season_name}</span>
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Back to News Button */}
        <div className="mt-8 text-center">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            View More News
          </Link>
        </div>
      </div>
    </div>
  )
}
