'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import NewsReactions from '@/components/NewsReactions'

interface NewsItem {
  id: string
  // Bilingual support
  title?: string // Legacy
  title_en?: string
  title_ml?: string
  content?: string // Legacy
  content_en?: string
  content_ml?: string
  summary?: string // Legacy
  summary_en?: string
  summary_ml?: string
  reporter_en?: string
  reporter_ml?: string
  category: string
  event_type: string
  season_id?: string
  season_name?: string
  created_at: string
  published_at?: string
  generated_by: 'ai' | 'admin'
  image_url?: string
  tone?: string
  language?: string
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
  const { language, setLanguage } = useLanguage()

  const [news, setNews] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper to get localized text
  const getLocalizedText = (field: 'title' | 'content' | 'summary' | 'reporter'): string => {
    if (!news) return ''
    
    if (language === 'ml') {
      const mlField = `${field}_ml` as keyof NewsItem
      if (news[mlField]) return news[mlField] as string
    }
    
    // Fallback: English or legacy single field
    const enField = `${field}_en` as keyof NewsItem
    return (news[enField] || news[field] || '') as string
  }

  useEffect(() => {
    if (id) {
      fetchNewsItem()
    }
  }, [id])

  // Update meta tags dynamically for social sharing
  useEffect(() => {
    if (!news) return

    const title = getLocalizedText('title')
    const description = getLocalizedText('summary') || getLocalizedText('content').substring(0, 160)
    const imageUrl = news.image_url || ''
    const url = window.location.href

    // Update document title
    document.title = `${title} | SS Super League`

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string, isProperty = true) => {
      const attribute = isProperty ? 'property' : 'name'
      let tag = document.querySelector(`meta[${attribute}="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute(attribute, property)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }

    // Standard meta tags
    updateMetaTag('description', description, false)

    // Open Graph tags
    updateMetaTag('og:type', 'article')
    updateMetaTag('og:url', url)
    updateMetaTag('og:title', title)
    updateMetaTag('og:description', description)
    updateMetaTag('og:site_name', 'SS Super League')
    
    if (imageUrl) {
      updateMetaTag('og:image', imageUrl)
      updateMetaTag('og:image:secure_url', imageUrl)
      updateMetaTag('og:image:width', '1200')
      updateMetaTag('og:image:height', '630')
      updateMetaTag('og:image:alt', title)
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image', false)
    updateMetaTag('twitter:url', url, false)
    updateMetaTag('twitter:title', title, false)
    updateMetaTag('twitter:description', description, false)
    if (imageUrl) {
      updateMetaTag('twitter:image', imageUrl, false)
    }
  }, [news, language])

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

  const handleShare = () => {
    if (!news) return

    const title = getLocalizedText('title')
    const summary = getLocalizedText('summary')
    const content = getLocalizedText('content')
    const currentUrl = window.location.href
    const shareText = `*${title}*\n\n${summary || content.slice(0, 200) + '...'}\n\nRead more: ${currentUrl}`
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
    window.open(whatsappUrl, '_blank')
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

        {/* Language Toggle */}
        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={() => setLanguage('en')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              language === 'en'
                ? 'bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLanguage('ml')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              language === 'ml'
                ? 'bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
            }`}
          >
            മലയാളം
          </button>
        </div>

        {/* Article Container */}
        <article className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Featured Image */}
          {news.image_url && (
            <div className="w-full h-96 overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
              <img
                src={news.image_url}
                alt={getLocalizedText('title')}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-8 lg:p-12">
            {/* Category, Date & Share */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
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
              <button
                onClick={handleShare}
                className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-all shadow-md hover:shadow-lg"
                title="Share on WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Share
              </button>
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {getLocalizedText('title')}
            </h1>

            {/* Reporter */}
            {getLocalizedText('reporter') && (
              <div className="flex items-center gap-2 text-gray-600 mb-4">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{getLocalizedText('reporter')}</span>
                {news.tone && <span className="text-sm text-gray-500">• {news.tone}</span>}
              </div>
            )}

            {/* Summary */}
            {getLocalizedText('summary') && (
              <p className="text-xl text-gray-700 leading-relaxed mb-8 pb-8 border-b border-gray-200 font-medium">
                {getLocalizedText('summary')}
              </p>
            )}

            {/* Full Content */}
            <div className="prose prose-lg max-w-none">
              <div className="text-gray-800 leading-relaxed whitespace-pre-line text-lg">
                {getLocalizedText('content')}
              </div>
            </div>

            {/* News Reactions */}
            <NewsReactions newsId={news.id} />

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
