'use client';

import { useEffect, useState } from 'react';
import { fetchRewards } from '@/lib/data';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import type { Reward } from '@/lib/types';
import { Trophy, Gift } from 'lucide-react';

// Rewards are scoped to a location (fetchRewards takes a locationId), and
// MainFeedTab never had real rewards UI (just a "Coming Soon" stub) — so
// this builds a simple grid straight off lib/data.ts's fetchRewards().
export default function RewardsPanel() {
  const { selectedLocation } = useStore();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedLocation) {
      setRewards([]);
      return;
    }
    setLoading(true);
    fetchRewards(selectedLocation.id)
      .then(setRewards)
      .catch((err) => console.error('Failed to load rewards:', err))
      .finally(() => setLoading(false));
  }, [selectedLocation]);

  const panelStyle = {
    backgroundColor: theme.surface,
    borderRadius: '16px',
    border: `1px solid ${theme.divider}`,
    padding: '16px',
    margin: '0 20px 20px'
  };

  return (
    <div style={panelStyle}>
      <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Rewards
      </h3>

      {!selectedLocation && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Trophy style={{ width: '28px', height: '28px', color: theme.muted, margin: '0 auto 10px' }} />
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Check in to a location to see its rewards
          </p>
        </div>
      )}

      {selectedLocation && loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <span className="spinner" />
        </div>
      )}

      {selectedLocation && !loading && rewards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Gift style={{ width: '28px', height: '28px', color: theme.muted, margin: '0 auto 10px' }} />
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            No rewards here yet
          </p>
        </div>
      )}

      {selectedLocation && !loading && rewards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {rewards.map((reward) => (
            <div key={reward.id} style={{
              backgroundColor: theme.surface2,
              borderRadius: '12px',
              padding: '14px',
              border: `1px solid ${theme.divider}`
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '9999px',
                backgroundColor: `${theme.accent}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px'
              }}>
                <Trophy style={{ width: '16px', height: '16px', color: theme.accent }} />
              </div>
              <p style={{ color: theme.text, fontSize: '14px', fontWeight: 600, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {reward.name}
              </p>
              {reward.deal_text && (
                <p style={{ color: theme.muted, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  {reward.deal_text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
