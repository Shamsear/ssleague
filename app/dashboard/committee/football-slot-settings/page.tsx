'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { fetchWithTokenRefresh } from '@/lib/token-refresh'

export default function FootballSlotSettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null)
  const [seasonName, setSeasonName] = useState<string>('')
  
  const [settings, setSettings] = useState({
    football_base_slots: 25,
    football_max_purchasable_slots: 3,
    football_slot_price: 10,
    football_slot_purchase_enabled: true
  })

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'committee_admin') return

      try {
        setLoading(true)
        
        // Get current season
        const seasonsQuery = query(
          collection(db, 'seasons'),
          where('isActive', '==', true),
          limit(1)
        )
        const seasonsSnapshot = await getDocs(seasonsQuery)

        if (seasonsSnapshot.empty) {
          setMessage({ type: 'error', text: 'No active season found' })
          setLoading(false)
          return
        }

        const seasonDoc = seasonsSnapshot.docs[0]
        const seasonId = seasonDoc.id
        const seasonData = seasonDoc.data()
        
        setCurrentSeasonId(seasonId)
        setSeasonName(seasonData.name || `Season ${seasonData.season_number || ''}`)

        // Fetch slot settings
        const response = await fetchWithTokenRefresh(`/api/football-slot-settings?season_id=${seasonId}`)
        const data = await response.json()

        if (data.success) {
          setSettings(data.data)
        }
      } catch (error: any) {
        console.error('Error fetching data:', error)
        setMessage({ type: 'error', text: 'Failed to load settings' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleSave = async () => {
    if (!currentSeasonId) return

    setSaving(true)
    setMessage(null)

    try {
      const response = await fetchWithTokenRefresh('/api/football-slot-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: currentSeasonId,
          ...settings
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (error: any) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin') {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">⚙️ Football Slot Settings</h1>
            <p className="text-gray-600">Configure player slot limits and pricing for {seasonName}</p>
          </div>
          <Link
            href="/dashboard/committee"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`glass rounded-xl p-4 mb-6 ${
          message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        } border`}>
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="glass rounded-xl p-6 mb-6 bg-blue-50/50 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 How Slot Management Works</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Base Slots:</strong> Every team gets this many slots by default (currently hardcoded as 25)</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Purchasable Slots:</strong> Teams can buy additional slots up to the maximum limit</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Slot Price:</strong> Cost in eCoin (₡) per additional slot</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Total Slots:</strong> Base + Purchased = Total available slots for each team</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>Bulk Auction:</strong> Teams can only bid on players if they have available slots</span>
          </li>
        </ul>
      </div>

      {/* Settings Form */}
      <div className="glass rounded-3xl p-6 shadow-lg">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Slot Configuration</h2>

        <div className="space-y-6">
          {/* Base Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Slots (Default for all teams)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={settings.football_base_slots}
              onChange={(e) => setSettings({ ...settings, football_base_slots: parseInt(e.target.value) || 25 })}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Every team starts with this many player slots (recommended: 25)
            </p>
          </div>

          {/* Max Purchasable Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Purchasable Slots
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={settings.football_max_purchasable_slots}
              onChange={(e) => setSettings({ ...settings, football_max_purchasable_slots: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Maximum additional slots a team can purchase (recommended: 3)
            </p>
          </div>

          {/* Slot Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Per Slot (eCoin)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₡</span>
              <input
                type="number"
                min="0"
                max="10000"
                value={settings.football_slot_price}
                onChange={(e) => setSettings({ ...settings, football_slot_price: parseInt(e.target.value) || 0 })}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Cost in eCoin for each additional slot (recommended: 10)
            </p>
          </div>

          {/* Enable/Disable Purchases */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allow Slot Purchases
              </label>
              <p className="text-sm text-gray-500">
                Teams can purchase additional slots if enabled
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, football_slot_purchase_enabled: !settings.football_slot_purchase_enabled })}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                settings.football_slot_purchase_enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.football_slot_purchase_enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Summary */}
          <div className="glass p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
            <h4 className="font-semibold text-gray-800 mb-2">📊 Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Base Slots:</span>
                <span className="ml-2 font-bold text-gray-900">{settings.football_base_slots}</span>
              </div>
              <div>
                <span className="text-gray-600">Max Total Slots:</span>
                <span className="ml-2 font-bold text-gray-900">
                  {settings.football_base_slots + settings.football_max_purchasable_slots}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Price Per Slot:</span>
                <span className="ml-2 font-bold text-gray-900">₡{settings.football_slot_price}</span>
              </div>
              <div>
                <span className="text-gray-600">Max Purchase Cost:</span>
                <span className="ml-2 font-bold text-gray-900">
                  ₡{settings.football_max_purchasable_slots * settings.football_slot_price}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={() => router.push('/dashboard/committee')}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
