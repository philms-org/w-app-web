'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchVenue,
  fetchAttendeeHistory,
  fetchVerificationTags,
  assignVerificationTag,
  removeVerificationTag,
} from '@/lib/data';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';
import type { Venue, Profile, VerificationTag } from '@/lib/types';

export default function AdminVenueTagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: locationId } = use(params);

  const [venue, setVenue] = useState<Venue | null>(null);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [tags, setTags] = useState<VerificationTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagTextByUserId, setTagTextByUserId] = useState<Record<string, string>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { canManage } = useIsOrganizer(locationId);

  const tagsByUserId = useMemo(() => {
    const map = new Map<string, VerificationTag[]>();
    for (const t of tags) {
      const existing = map.get(t.user_id);
      if (existing) existing.push(t);
      else map.set(t.user_id, [t]);
    }
    return map;
  }, [tags]);

  const loadTags = () => {
    fetchVerificationTags(locationId)
      .then(setTags)
      .catch((err) => console.error('Failed to load verification tags:', err));
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchVenue(locationId), fetchAttendeeHistory(locationId), fetchVerificationTags(locationId)])
      .then(([venueRow, attendeeRows, tagRows]) => {
        setVenue(venueRow);
        setAttendees(attendeeRows);
        setTags(tagRows);
      })
      .catch((err) => {
        console.error('Failed to load venue tag data:', err);
        setError("Couldn't load this venue — try again");
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  const handleAssignTag = (userId: string) => {
    const value = (tagTextByUserId[userId] ?? '').trim();
    if (!value) return;
    setSavingUserId(userId);
    setError(null);
    assignVerificationTag(userId, locationId, value)
      .then(() => {
        setTagTextByUserId((prev) => ({ ...prev, [userId]: '' }));
        loadTags();
      })
      .catch((err) => {
        console.error('Failed to assign tag:', err);
        setError("Couldn't assign tag — try again");
      })
      .finally(() => setSavingUserId(null));
  };

  const handleRemoveTag = (userId: string, tagId: string) => {
    setSavingUserId(userId);
    setError(null);
    removeVerificationTag(tagId)
      .then(() => loadTags())
      .catch((err) => {
        console.error('Failed to remove tag:', err);
        setError("Couldn't remove tag — try again");
      })
      .finally(() => setSavingUserId(null));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          You&apos;re not authorized to manage this venue&apos;s tags.
        </p>
        <Link
          href="/admin"
          style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
        >
          Back to admin
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <Link
          href="/admin"
          style={{ color: theme.accent, fontSize: '13px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif', textDecoration: 'none' }}
        >
          Back to admin
        </Link>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
          marginTop: '8px',
        }}>
          Manage Tags{venue ? ` — ${venue.name}` : ''}
        </h1>
      </div>

      <div style={{ padding: '20px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        {attendees.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            No attendees found at this venue yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {attendees.map((attendee) => {
              const attendeeTags = tagsByUserId.get(attendee.id) ?? [];
              const isSaving = savingUserId === attendee.id;
              return (
                <div
                  key={attendee.id}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: '16px',
                    border: `1px solid ${theme.divider}`,
                    padding: '16px',
                  }}
                >
                  <p style={{
                    color: theme.text,
                    fontSize: '15px',
                    fontWeight: 600,
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                    marginBottom: '10px',
                  }}>
                    {attendee.display_name}
                  </p>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={tagTextByUserId[attendee.id] ?? ''}
                      onChange={(e) =>
                        setTagTextByUserId((prev) => ({ ...prev, [attendee.id]: e.target.value }))
                      }
                      placeholder={`Tag ${attendee.display_name ?? 'them'} (e.g. DJ, Host)...`}
                      style={{
                        flex: 1,
                        backgroundColor: theme.pill,
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '10px 16px',
                        fontSize: '14px',
                        color: theme.bg,
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    />
                    <button
                      onClick={() => handleAssignTag(attendee.id)}
                      disabled={isSaving || !(tagTextByUserId[attendee.id] ?? '').trim()}
                      style={{
                        backgroundColor: theme.accent,
                        color: 'white',
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: isSaving || !(tagTextByUserId[attendee.id] ?? '').trim() ? 'default' : 'pointer',
                        opacity: isSaving || !(tagTextByUserId[attendee.id] ?? '').trim() ? 0.6 : 1,
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    >
                      Assign tag
                    </button>
                  </div>

                  {attendeeTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                      {attendeeTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleRemoveTag(attendee.id, t.id)}
                          disabled={isSaving}
                          style={{
                            backgroundColor: theme.surface2,
                            color: theme.text,
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            cursor: isSaving ? 'default' : 'pointer',
                            opacity: isSaving ? 0.6 : 1,
                            fontFamily: 'Montserrat, system-ui, sans-serif',
                          }}
                        >
                          Remove &ldquo;{t.tag}&rdquo;
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
