'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

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
  is_published: boolean
  generated_by: 'ai' | 'admin'
  edited_by_admin?: boolean
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

export default function AdminNewsPage() {
  const { user, loading: authLoading } = useAuth()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'drafts' | 'published'>('drafts')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<NewsItem>>({})

  useEffect(() => {
    if (!authLoading && user && (user.role === 'committee_admin' || user.role === 'super_admin')) {
      fetchNews()
    }
  }, [filter, user, authLoading])

  const fetchNews = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('include_drafts', 'true')
      params.append('limit', '100')

      const response = await fetch(`/api/news?${params.toString()}`)
      const data = await response.json()
      
      let filtered = data.news || []
      if (filter === 'drafts') {
        filtered = filtered.filter((n: NewsItem) => !n.is_published)
      } else if (filter === 'published') {
        filtered = filtered.filter((n: NewsItem) => n.is_published)
      }
      
      setNews(filtered)
    } catch (err) {
      console.error('Failed to fetch news:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (id: string) => {
    if (!confirm('Publish this news item?')) return

    try {
      const item = news.find(n => n.id === id)
      if (!item) return

      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          is_published: true,
          published_at: new Date(),
        }),
      })

      if (response.ok) {
        alert('News published successfully!')
        fetchNews()
      } else {
        alert('Failed to publish news')
      }
    } catch (err) {
      console.error('Error publishing:', err)
      alert('Failed to publish news')
    }
  }

  const handleUnpublish = async (id: string) => {
    if (!confirm('Unpublish this news item?')) return

    try {
      const item = news.find(n => n.id === id)
      if (!item) return

      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          is_published: false,
        }),
      })

      if (response.ok) {
        alert('News unpublished successfully!')
        fetchNews()
      } else {
        alert('Failed to unpublish news')
      }
    } catch (err) {
      console.error('Error unpublishing:', err)
      alert('Failed to unpublish news')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this news item permanently?')) return

    try {
      const response = await fetch(`/api/news?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('News deleted successfully!')
        fetchNews()
      } else {
        alert('Failed to delete news')
      }
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Failed to delete news')
    }
  }

  const startEdit = (item: NewsItem) => {
    setEditingId(item.id)
    setEditForm(item)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async () => {
    if (!editingId) return

    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        alert('News updated successfully!')
        setEditingId(null)
        setEditForm({})
        fetchNews()
      } else {
        alert('Failed to update news')
      }
    } catch (err) {
      console.error('Error updating:', err)
      alert('Failed to update news')
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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-lg p-6 shadow">
                  <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📰 News Management</h1>
          <p className="text-gray-600">Review and publish AI-generated news</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('drafts')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'drafts'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Drafts ({news.filter(n => !n.is_published).length})
          </button>
          <button
            onClick={() => setFilter('published')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'published'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Published ({news.filter(n => n.is_published).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            All ({news.length})
          </button>
        </div>

        {/* News List */}
        {news.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center shadow">
            <p className="text-gray-500 text-lg">No news items found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-md border border-gray-200">
                {editingId === item.id ? (
                  // Edit Mode
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={editForm.title || ''}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Summary (optional)
                      </label>
                      <input
                        type="text"
                        value={editForm.summary || ''}
                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content
                      </label>
                      <textarea
                        value={editForm.content || ''}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        rows={8}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    {/* Image Preview */}
                    {item.image_url && (
                      <div className="w-full h-48 overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[item.category]}`}>
                          {item.category.toUpperCase()}
                        </span>
                        {item.generated_by === 'ai' && (
                          <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded text-xs font-medium">
                            🤖 AI Generated
                          </span>
                        )}
                        {item.is_published ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                            ✓ Published
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                            📝 Draft
                          </span>
                        )}
                      </div>
                      <time className="text-sm text-gray-500">
                        {formatDate(item.created_at)}
                      </time>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h2>

                    {/* Summary */}
                    {item.summary && (
                      <p className="text-gray-600 mb-3 italic">{item.summary}</p>
                    )}

                    {/* Content Preview */}
                    <div className="text-gray-700 mb-4 whitespace-pre-line line-clamp-3">
                      {item.content}
                    </div>

                    {/* Season */}
                    {item.season_name && (
                      <p className="text-sm text-gray-500 mb-4">Season: {item.season_name}</p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => startEdit(item)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        ✏️ Edit
                      </button>
                      {item.is_published ? (
                        <button
                          onClick={() => handleUnpublish(item.id)}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                        >
                          📥 Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublish(item.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          ✓ Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
