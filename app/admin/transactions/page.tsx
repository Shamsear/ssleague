'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Team = {
  id: number;
  team_name: string;
  balance: number;
};

type Season = {
  id: number;
  season_name: string;
};

type TransactionType = 'fine' | 'bonus' | 'adjustment';
type CurrencyType = 'football' | 'real_player';

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [transactionType, setTransactionType] = useState<TransactionType>('fine');
  const [currencyType, setCurrencyType] = useState<CurrencyType>('football');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [adminName, setAdminName] = useState<string>('Admin');

  // Load seasons on mount
  useEffect(() => {
    fetchSeasons();
    // Get admin name from localStorage or session
    const storedName = localStorage.getItem('adminName') || 'Admin';
    setAdminName(storedName);
  }, []);

  // Load teams when season changes
  useEffect(() => {
    if (selectedSeason) {
      fetchTeams(selectedSeason);
    }
  }, [selectedSeason]);

  const fetchSeasons = async () => {
    try {
      const res = await fetch('/api/seasons');
      const data = await res.json();
      setSeasons(data);
      if (data.length > 0) {
        setSelectedSeason(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const fetchTeams = async (seasonId: string) => {
    try {
      const res = await fetch(`/api/seasons/${seasonId}/teams`);
      const data = await res.json();
      setTeams(data);
      if (data.length > 0) {
        setSelectedTeam(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const endpoint = `/api/admin/transactions/${transactionType}`;
      const bodyKey = transactionType === 'adjustment' ? 'adjustedBy' : 'issuedBy';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam,
          amount: parseFloat(amount),
          reason,
          seasonId: selectedSeason,
          currencyType,
          [bodyKey]: adminName
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process transaction');
      }

      const currencySymbol = currencyType === 'football' ? '€' : '$';
      setMessage({
        type: 'success',
        text: `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} successfully applied to ${data.teamName}. New ${currencyType === 'football' ? 'Euro' : 'Dollar'} balance: ${currencySymbol}${data.newBalance}`
      });

      // Reset form
      setAmount('');
      setReason('');

      // Refresh teams to show updated balance
      fetchTeams(selectedSeason);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedTeamData = teams.find(t => t.id.toString() === selectedTeam);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Transaction Management</h1>
        <p className="text-gray-600">Issue fines, bonuses, or manual adjustments to team balances</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Season Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Season</label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          >
            {seasons.map(season => (
              <option key={season.id} value={season.id}>
                {season.season_name}
              </option>
            ))}
          </select>
        </div>

        {/* Team Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          >
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.team_name} (Balance: ${team.balance})
              </option>
            ))}
          </select>
          {selectedTeamData && (
            <p className="text-sm text-gray-600 mt-2">
              Current Balance: <span className="font-semibold">${selectedTeamData.balance}</span>
            </p>
          )}
        </div>

        {/* Transaction Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Transaction Type</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="fine"
                checked={transactionType === 'fine'}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="mr-2"
              />
              Fine (Deduct)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="bonus"
                checked={transactionType === 'bonus'}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="mr-2"
              />
              Bonus (Add)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="adjustment"
                checked={transactionType === 'adjustment'}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="mr-2"
              />
              Adjustment (+/-)
            </label>
          </div>
        </div>

        {/* Currency Type */}
        <div>
          <label className="block text-sm font-medium mb-2">Currency Type</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="real_player"
                checked={currencyType === 'real_player'}
                onChange={(e) => setCurrencyType(e.target.value as CurrencyType)}
                className="mr-2"
              />
              💵 Dollar (Real Players)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="football"
                checked={currencyType === 'football'}
                onChange={(e) => setCurrencyType(e.target.value as CurrencyType)}
                className="mr-2"
              />
              💶 Euro (Football Players)
            </label>
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Amount {transactionType === 'adjustment' && '(use negative for deduction)'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded px-3 py-2"
            step="0.01"
            min={transactionType === 'adjustment' ? undefined : '0.01'}
            required
            placeholder={transactionType === 'adjustment' ? 'e.g., 100 or -50' : 'e.g., 100'}
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium mb-2">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
            required
            placeholder="Explain why this transaction is being made..."
          />
        </div>

        {/* Preview */}
        {amount && selectedTeamData && (
          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-semibold mb-2">Preview</h3>
            <div className="text-sm space-y-1">
              <p className="font-medium text-gray-700 mb-2">
                {currencyType === 'football' ? '💶 Euro Balance' : '💵 Dollar Balance'}
              </p>
              <p>Current Balance: {currencyType === 'football' ? '€' : '$'}{selectedTeamData.balance}</p>
              <p className={parseFloat(amount) < 0 || transactionType === 'fine' ? 'text-red-600' : 'text-green-600'}>
                Change: {transactionType === 'fine' ? '-' : transactionType === 'bonus' ? '+' : ''}{currencyType === 'football' ? '€' : '$'}{Math.abs(parseFloat(amount) || 0)}
              </p>
              <p className="font-semibold">
                New Balance: {currencyType === 'football' ? '€' : '$'}
                {transactionType === 'fine' 
                  ? selectedTeamData.balance - Math.abs(parseFloat(amount) || 0)
                  : transactionType === 'bonus'
                  ? selectedTeamData.balance + Math.abs(parseFloat(amount) || 0)
                  : selectedTeamData.balance + (parseFloat(amount) || 0)
                }
              </p>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`p-4 rounded ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : `Apply ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}`}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Instructions */}
      <div className="mt-6 bg-blue-50 p-4 rounded text-sm">
        <h3 className="font-semibold mb-2">💡 Transaction Types</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Fine:</strong> Deduct money from team (always positive amount)</li>
          <li><strong>Bonus:</strong> Add money to team (always positive amount)</li>
          <li><strong>Adjustment:</strong> Manual correction (positive adds, negative deducts)</li>
        </ul>
        <h3 className="font-semibold mb-2 mt-4">💰 Currency Types</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>💵 Dollar (Real Players):</strong> Affects team's dollar balance (for SS Members)</li>
          <li><strong>💶 Euro (Football Players):</strong> Affects team's euro balance (for football players)</li>
        </ul>
      </div>
    </div>
  );
}
