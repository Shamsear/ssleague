'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface Team {
  teamId: string
  teamName: string
  currencySystem: string
  football_budget: number
  real_player_budget: number
}

export default function RefundsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [refundType, setRefundType] = useState<'football' | 'real_player'>('football')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/committee/refunds/teams')
      const data = await response.json()

      if (data.success) {
        setTeams(data.teams || [])
        setSeasonName(data.seasonName || '')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Error loading teams:', error)
      alert('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && user.role === 'committee_admin') {
      loadTeams()
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTeam || !amount || !reason) {
      alert('Please fill in all fields')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid positive amount')
      return
    }

    const team = teams.find(t => t.teamId === selectedTeam)
    if (!team) {
      alert('Team not found')
      return
    }

    if (!confirm(`Send £${amountNum.toFixed(2)} ${refundType === 'football' ? 'football' : 'real player'} refund to ${team.teamName}?\n\nReason: ${reason}`)) {
      return
    }

    setProcessing(true)
    try {
      const response = await fetch('/api/committee/refunds/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam,
          refundType,
          amount: amountNum,
          reason
        })
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Refund sent successfully!\n\nTeam: ${team.teamName}\nAmount: £${amountNum.toFixed(2)}\nType: ${refundType === 'football' ? 'Football' : 'Real Player'}`)
        
        // Reset form
        setSelectedTeam('')
        setAmount('')
        setReason('')
        
        // Reload teams to show updated budgets
        await loadTeams()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Error sending refund:', error)
      alert('Failed to send refund')
    } finally {
      setProcessing(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin') {
    return null
  }

  const selectedTeamData = teams.find(t => t.teamId === selectedTeam)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">💸 Send Refunds</h1>
            <p className="text-gray-600">Issue refunds to teams for {seasonName}</p>
          </div>
          <Link
            href="/dashboard/committee"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Info Box */}
      <div className="glass rounded-xl p-4 mb-6 bg-blue-50 border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ How Refunds Work</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Refunds increase team budgets (football_budget or real_player_budget)</li>
          <li>• Refunds decrease spent amounts (football_spent or real_player_spent)</li>
          <li>• Transaction records are created in both Firebase and Neon</li>
          <li>• All changes are logged for audit purposes</li>
        </ul>
      </div>

      {/* Refund Form */}
      <div className="glass rounded-3xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Issue Refund</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Choose a team --</option>
              {teams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamName} ({team.currencySystem})
                </option>
              ))}
            </select>
          </div>

          {/* Current Budgets Display */}
          {selectedTeamData && (
            <div className="glass rounded-xl p-4 bg-gray-50 border border-gray-200">
              <h4 className="font-semibold text-gray-800 mb-3">Current Budgets</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Football Budget</div>
                  <div className="text-lg font-bold text-green-600">£{selectedTeamData.football_budget.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Real Player Budget</div>
                  <div className="text-lg font-bold text-purple-600">£{selectedTeamData.real_player_budget.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Refund Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refund Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRefundType('football')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  refundType === 'football'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                ⚽ Football Player
              </button>
              <button
                type="button"
                onClick={() => setRefundType('real_player')}
                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                  refundType === 'real_player'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                💎 Real Player
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refund Amount (£)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Refund
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for this refund..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Preview */}
          {selectedTeamData && amount && parseFloat(amount) > 0 && (
            <div className="glass rounded-xl p-4 bg-yellow-50 border border-yellow-200">
              <h4 className="font-semibold text-yellow-900 mb-2">Preview</h4>
              <div className="text-sm text-yellow-800 space-y-1">
                <div>Team: <strong>{selectedTeamData.teamName}</strong></div>
                <div>Type: <strong>{refundType === 'football' ? 'Football Player' : 'Real Player'}</strong></div>
                <div>Amount: <strong>£{parseFloat(amount).toFixed(2)}</strong></div>
                <div>
                  New Budget: <strong className="text-green-700">
                    £{(refundType === 'football' 
                      ? selectedTeamData.football_budget + parseFloat(amount)
                      : selectedTeamData.real_player_budget + parseFloat(amount)
                    ).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={processing || !selectedTeam || !amount || !reason}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {processing ? '⏳ Processing...' : '💸 Send Refund'}
          </button>
        </form>
      </div>
    </div>
  )
}
