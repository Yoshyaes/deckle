'use client';

import { useState } from 'react';

interface BillingActionsProps {
  currentPlan: string;
}

export function BillingActions({ currentPlan }: BillingActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (plan: 'starter' | 'pro') => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error?.message || 'Failed to create checkout session');
      }
    } catch {
      alert('Failed to initiate upgrade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'portal' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error?.message || 'Failed to open billing portal');
      }
    } catch {
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (currentPlan === 'free') {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleUpgrade('starter')}
          disabled={loading}
          className="px-4 py-2 rounded-lg border border-accent text-accent text-sm font-semibold hover:bg-accent/10 disabled:opacity-50"
        >
          Starter $29/mo
        </button>
        <button
          onClick={() => handleUpgrade('pro')}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Pro $99/mo'}
        </button>
      </div>
    );
  }

  if (currentPlan !== 'enterprise') {
    return (
      <button
        onClick={handleManageBilling}
        disabled={loading}
        className="px-4 py-2 rounded-lg border border-border text-text-primary text-sm font-medium hover:bg-surface-hover disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Manage Subscription'}
      </button>
    );
  }

  return null;
}
