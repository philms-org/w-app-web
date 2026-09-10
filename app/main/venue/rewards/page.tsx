'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchAllRewards,
  createReward,
  updateReward,
  deleteReward,
} from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Reward } from '@/lib/types';
import VenueSwitcher from '@/components/shared/VenueSwitcher';

export default function VenueRewardsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        </div>
      }
    >
      <VenueRewardsPageInner />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: theme.pill,
  border: 'none',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '13px',
  color: theme.text,
  fontFamily: 'Montserrat, system-ui, sans-serif',
  width: '100%',
  boxSizing: 'border-box',
};

function VenueRewardsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDeal, setNewDeal] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [creating, setCreating] = useState(false);

  const [editedFields, setEditedFields] = useState<Record<string, { name: string; deal_text: string; instructions: string; min_checkins: string }>>({});

  const { canManage } = useIsOrganizer(venue?.id);

  useEffect(() => {
    if (paramLocationId) {
      setVenueLoading(true);
      fetchVenue(paramLocationId)
        .then(setVenue)
        .catch((err) => {
          console.error('Failed to load venue:', err);
          setVenue(null);
        })
        .finally(() => setVenueLoading(false));
      return;
    }

    setVenueLoading(true);
    fetchMyVenues()
      .then((venues) => {
        setMyVenues(venues);
        setSelectedVenueId((current) => current ?? venues[0]?.id ?? null);
        if (venues.length === 0) setVenue(null);
      })
      .catch((err) => {
        console.error('Failed to load venues:', err);
        fetchMyVenue().then(setVenue).catch(() => setVenue(null));
      })
      .finally(() => setVenueLoading(false));
  }, [paramLocationId]);

  useEffect(() => {
    if (paramLocationId || !selectedVenueId) return;
    fetchVenue(selectedVenueId)
      .then(setVenue)
      .catch((err) => {
        console.error('Failed to load selected venue:', err);
        setVenue(null);
      });
  }, [selectedVenueId, paramLocationId]);

  const loadRewards = (locationId: string) => {
    setRewardsLoading(true);
    fetchAllRewards(locationId)
      .then((rows) => {
        setRewards(rows);
        setEditedFields(
          Object.fromEntries(
            rows.map((r) => [
              r.id,
              {
                name: r.name,
                deal_text: r.deal_text ?? '',
                instructions: r.instructions ?? '',
                min_checkins: r.min_checkins != null ? String(r.min_checkins) : '',
              },
            ])
          )
        );
      })
      .catch((err) => {
        console.error('Failed to load rewards:', err);
        setError("Couldn't load rewards — try again");
      })
      .finally(() => setRewardsLoading(false));
  };

  useEffect(() => {
    if (venue) loadRewards(venue.id);
  }, [venue]);

  if (venueLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!venue || !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          You&apos;re not authorized to manage this venue&apos;s rewards.
        </p>
        <Link href="/main" style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
          Back to app
        </Link>
      </div>
    );
  }

  const sorted = [...rewards].sort((a, b) => a.display_order - b.display_order);

  const handleCreate = () => {
    if (!newName.trim() || !venue) return;
    setCreating(true);
    setError(null);
    createReward(venue.id, {
      name: newName.trim(),
      deal_text: newDeal.trim() || null,
      instructions: newInstructions.trim() || null,
    })
      .then(() => {
        setNewName('');
        setNewDeal('');
        setNewInstructions('');
        setShowNew(false);
        loadRewards(venue.id);
      })
      .catch((err) => {
        console.error('Failed to create reward:', err);
        setError("Couldn't create reward — try again");
      })
      .finally(() => setCreating(false));
  };

  const handleFieldBlur = (reward: Reward) => {
    const edited = editedFields[reward.id];
    if (!edited) return;
    const parsedMinCheckins = edited.min_checkins.trim() === '' ? null : parseInt(edited.min_checkins, 10);
    const nextFields: Partial<Reward> = {
      name: edited.name.trim() || reward.name,
      deal_text: edited.deal_text.trim() || null,
      instructions: edited.instructions.trim() || null,
      min_checkins: Number.isNaN(parsedMinCheckins as number) ? null : parsedMinCheckins,
    };
    const unchanged =
      nextFields.name === reward.name &&
      (nextFields.deal_text ?? null) === (reward.deal_text ?? null) &&
      (nextFields.instructions ?? null) === (reward.instructions ?? null) &&
      (nextFields.min_checkins ?? null) === (reward.min_checkins ?? null);
    if (unchanged) return;

    setBusyId(reward.id);
    setError(null);
    updateReward(reward.id, nextFields)
      .then(() => {
        setRewards((prev) => prev.map((r) => (r.id === reward.id ? { ...r, ...nextFields } as Reward : r)));
      })
      .catch((err) => {
        console.error('Failed to update reward:', err);
        setError("Couldn't save reward — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleToggleActive = (reward: Reward) => {
    setBusyId(reward.id);
    setError(null);
    updateReward(reward.id, { is_active: !reward.is_active })
      .then(() => {
        setRewards((prev) => prev.map((r) => (r.id === reward.id ? { ...r, is_active: !r.is_active } : r)));
      })
      .catch((err) => {
        console.error('Failed to toggle reward:', err);
        setError("Couldn't update reward — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleDelete = (reward: Reward) => {
    setBusyId(reward.id);
    setError(null);
    deleteReward(reward.id)
      .then(() => setRewards((prev) => prev.filter((r) => r.id !== reward.id)))
      .catch((err) => {
        console.error('Failed to delete reward:', err);
        setError("Couldn't delete reward — try again");
      })
      .finally(() => setBusyId(null));
  };

  const handleMove = (reward: Reward, direction: 'up' | 'down') => {
    const idx = sorted.findIndex((r) => r.id === reward.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];

    setBusyId(reward.id);
    setError(null);
    Promise.all([
      updateReward(reward.id, { display_order: other.display_order }),
      updateReward(other.id, { display_order: reward.display_order }),
    ])
      .then(() => {
        setRewards((prev) =>
          prev.map((r) => {
            if (r.id === reward.id) return { ...r, display_order: other.display_order };
            if (r.id === other.id) return { ...r, display_order: reward.display_order };
            return r;
          })
        );
      })
      .catch((err) => {
        console.error('Failed to reorder rewards:', err);
        setError("Couldn't reorder rewards — try again");
      })
      .finally(() => setBusyId(null));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{ backgroundColor: theme.bg, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.divider}` }}>
        <button onClick={() => router.push('/main')} style={{ padding: '8px', marginLeft: '-8px', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.accent }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 600, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Manage Rewards
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />

      <div style={{ padding: '20px 20px 40px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Set a &quot;visits to unlock&quot; count to make a reward an attendance-tier badge (e.g. 10 visits = Regular). Leave it blank to show a reward to everyone.
        </p>

        {rewardsLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading rewards...</p>
        ) : sorted.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif', marginBottom: '20px' }}>
            No rewards yet — add one below.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {sorted.map((reward, i) => {
              const isBusy = busyId === reward.id;
              const edited = editedFields[reward.id] ?? { name: reward.name, deal_text: '', instructions: '', min_checkins: '' };
              return (
                <div key={reward.id} style={{ backgroundColor: theme.surface, borderRadius: '16px', border: `1px solid ${theme.divider}`, padding: '14px', opacity: isBusy ? 0.6 : 1 }}>
                  <input
                    type="text"
                    value={edited.name}
                    onChange={(e) => setEditedFields((prev) => ({ ...prev, [reward.id]: { ...edited, name: e.target.value } }))}
                    onBlur={() => handleFieldBlur(reward)}
                    disabled={isBusy}
                    placeholder="Reward name"
                    style={{ ...inputStyle, fontWeight: 700, marginBottom: '8px' }}
                  />
                  <input
                    type="text"
                    value={edited.deal_text}
                    onChange={(e) => setEditedFields((prev) => ({ ...prev, [reward.id]: { ...edited, deal_text: e.target.value } }))}
                    onBlur={() => handleFieldBlur(reward)}
                    disabled={isBusy}
                    placeholder="Deal text (e.g. 20% off your tab)"
                    style={{ ...inputStyle, marginBottom: '8px' }}
                  />
                  <textarea
                    value={edited.instructions}
                    onChange={(e) => setEditedFields((prev) => ({ ...prev, [reward.id]: { ...edited, instructions: e.target.value } }))}
                    onBlur={() => handleFieldBlur(reward)}
                    disabled={isBusy}
                    placeholder="Redemption instructions"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <label style={{ color: theme.muted, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      Visits to unlock:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={edited.min_checkins}
                      onChange={(e) => setEditedFields((prev) => ({ ...prev, [reward.id]: { ...edited, min_checkins: e.target.value } }))}
                      onBlur={() => handleFieldBlur(reward)}
                      disabled={isBusy}
                      placeholder="Any"
                      style={{ ...inputStyle, width: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleToggleActive(reward)}
                      disabled={isBusy}
                      style={{
                        backgroundColor: reward.is_active ? theme.green : theme.surface2,
                        color: reward.is_active ? '#0D0D0F' : theme.text,
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '5px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: isBusy ? 'default' : 'pointer',
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    >
                      {reward.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => handleMove(reward, 'up')} disabled={isBusy || i === 0} aria-label="Move up" style={{ backgroundColor: theme.surface2, border: 'none', borderRadius: '9999px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isBusy || i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1 }}>
                      <ChevronUp style={{ width: '16px', height: '16px', color: theme.text }} />
                    </button>
                    <button onClick={() => handleMove(reward, 'down')} disabled={isBusy || i === sorted.length - 1} aria-label="Move down" style={{ backgroundColor: theme.surface2, border: 'none', borderRadius: '9999px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isBusy || i === sorted.length - 1 ? 'default' : 'pointer', opacity: i === sorted.length - 1 ? 0.4 : 1 }}>
                      <ChevronDown style={{ width: '16px', height: '16px', color: theme.text }} />
                    </button>
                    <button onClick={() => handleDelete(reward)} disabled={isBusy} aria-label="Delete reward" style={{ backgroundColor: 'transparent', border: 'none', borderRadius: '9999px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isBusy ? 'default' : 'pointer', marginLeft: 'auto' }}>
                      <Trash2 style={{ width: '16px', height: '16px', color: theme.accent2 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showNew ? (
          <div style={{ backgroundColor: theme.surface, borderRadius: '16px', border: `1px solid ${theme.divider}`, padding: '14px' }}>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Reward name" style={{ ...inputStyle, marginBottom: '8px' }} />
            <input type="text" value={newDeal} onChange={(e) => setNewDeal(e.target.value)} placeholder="Deal text" style={{ ...inputStyle, marginBottom: '8px' }} />
            <textarea value={newInstructions} onChange={(e) => setNewInstructions(e.target.value)} placeholder="Redemption instructions" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: '10px' }} />
            {error && <p style={{ color: theme.accent2, fontSize: '12px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, backgroundColor: theme.surface2, color: theme.text, border: 'none', borderRadius: '9999px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{ flex: 1, backgroundColor: theme.accent, color: theme.onAccent, border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: creating || !newName.trim() ? 'default' : 'pointer', opacity: creating || !newName.trim() ? 0.6 : 1, fontFamily: 'Montserrat, system-ui, sans-serif' }}
              >
                {creating ? 'Creating...' : 'Create Reward'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: theme.accent, color: theme.onAccent, borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif' }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            Add reward
          </button>
        )}
      </div>
    </div>
  );
}
