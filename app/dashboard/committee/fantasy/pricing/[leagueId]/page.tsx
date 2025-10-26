'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Star, Save, Check } from 'lucide-react';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';

interface StarPricing {
  stars: number;
  price: number;
}

export default function FantasyPricingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pricing, setPricing] = useState<StarPricing[]>([
    { stars: 3, price: 5 },
    { stars: 4, price: 7 },
    { stars: 5, price: 10 },
    { stars: 6, price: 13 },
    { stars: 7, price: 16 },
    { stars: 8, price: 20 },
    { stars: 9, price: 25 },
    { stars: 10, price: 30 },
  ]);

  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchPricing();
  }, [leagueId]);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fantasy/pricing/${leagueId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch pricing');
      }

      const data = await response.json();
      
      if (data.pricing && Array.isArray(data.pricing)) {
        setPricing(data.pricing);
      }
    } catch (error) {
      console.error('Error fetching pricing:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to load pricing data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (stars: number, newPrice: string) => {
    const price = parseFloat(newPrice) || 0;
    setSaved(false); // Reset saved state when user makes changes
    setPricing((prev) =>
      prev.map((p) => (p.stars === stars ? { ...p, price } : p))
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate pricing
      const invalidPricing = pricing.find((p) => p.price <= 0);
      if (invalidPricing) {
        showAlert({
          type: 'error',
          title: 'Invalid Price',
          message: `Price for ${invalidPricing.stars} stars must be greater than 0`,
        });
        return;
      }

      const response = await fetch(`/api/fantasy/pricing/${leagueId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pricing }),
      });

      if (!response.ok) {
        throw new Error('Failed to save pricing');
      }

      showAlert({
        type: 'success',
        title: 'Success',
        message: 'Pricing updated successfully and saved to database',
      });
      
      // Show saved state
      setSaved(true);
      
      // Reset saved state after 3 seconds
      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving pricing:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to save pricing',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/dashboard/committee/fantasy/${leagueId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to League Dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Player Pricing</h1>
              <p className="text-gray-600 mt-1">Set prices based on star ratings</p>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Star Rating Pricing</h2>
          
          <div className="space-y-4">
            {pricing.map((item) => (
              <div 
                key={item.stars} 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200"
              >
                <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                    {[...Array(item.stars)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <span className="font-semibold text-gray-900">
                    {item.stars} Star{item.stars > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={item.price}
                    onChange={(e) => handlePriceChange(item.stars, e.target.value)}
                    className="w-28 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600 font-medium">credits</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`w-full px-6 py-3 text-white rounded-xl font-semibold disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl ${
                saved 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-5 h-5" />
                  Saved to Database ✓
                </>
              ) : saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Pricing
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">How It Works</h2>
          <div className="space-y-3 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
              <p>Players are assigned star ratings (1-5 stars) by committee admins</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
              <p>Each star rating corresponds to a credit price</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
              <p>Teams draft players within their budget using these prices</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
              <p>Adjust pricing here to balance the fantasy league economy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
