'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { fetchLastVisited, fetchFeed, fetchAttendeeHistory } from '@/lib/data';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import type { Venue, FeedItem, Profile } from '@/lib/types';
import { ChevronRight, ChevronLeft, Clock, User, BadgeCheck } from 'lucide-react';
import AttendeeStrip from '@/components/shared/AttendeeStrip';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';

interface DayGroup {
  dateLabel: string;
  items: FeedItem[];
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function groupByDay(items: FeedItem[]): DayGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    const key = dateFormatter.format(new Date(item.created_at));
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(item);
  }
  return order.map((key) => ({ dateLabel: key, items: buckets.get(key)! }));
}

// Inline panel version of HistoryTab's list -> detail flow, meant to render
// below QuickAccessRow on the Home tab (no tab-level back navigation — the
// venue detail collapses back into the list within the same panel).
export default function HistoryPanel() {
  const { setActiveTab } = useStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);

  useEffect(() => {
    fetchLastVisited(50)
      .then(setVenues)
      .catch((err) => console.error('Failed to load check-in history:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedVenue) return;
    setDetailLoading(true);
    fetchFeed(selectedVenue.id)
      .then((feed) => setGroups(groupByDay(feed)))
      .catch((err) => console.error('Failed to load venue history:', err))
      .finally(() => setDetailLoading(false));
  }, [selectedVenue]);

  useEffect(() => {
    if (!selectedVenue) return;
    let ignore = false;
    setAttendees([]);
    setSelectedAttendeeId(null);
    fetchAttendeeHistory(selectedVenue.id)
      .then((result) => {
        if (!ignore) setAttendees(result);
      })
      .catch((err) => console.error('Failed to load attendee history:', err));
    return () => {
      ignore = true;
    };
  }, [selectedVenue]);

  const selectedAttendee = attendees.find((a) => a.id === selectedAttendeeId) ?? null;

  const panelStyle: CSSProperties = {
    backgroundColor: theme.surface,
    borderRadius: '16px',
    border: `1px solid ${theme.divider}`,
    padding: '16px',
    margin: '0 20px 20px'
  };

  if (selectedVenue) {
    return (
      <div style={panelStyle}>
        <button
          onClick={() => setSelectedVenue(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.accent,
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '12px',
            padding: 0,
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          <ChevronLeft style={{ width: '16px', height: '16px' }} />
          History
        </button>

        <h3 style={{ color: theme.text, fontSize: '18px', fontWeight: 700, marginBottom: '2px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          {selectedVenue.name}
        </h3>
        {selectedVenue.address && (
          <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {selectedVenue.address}
          </p>
        )}

        {attendees.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{
              color: theme.muted,
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Who was there</p>
            <AttendeeStrip
              attendees={attendees}
              selectedId={selectedAttendeeId}
              onSelect={setSelectedAttendeeId}
            />
          </div>
        )}

        {selectedAttendee && (
          <div style={{ marginBottom: '16px' }}>
            <InlineMessageComposer
              recipient={selectedAttendee}
              onSent={() => {
                setSelectedAttendeeId(null);
                setActiveTab('messages');
              }}
            />
          </div>
        )}

        {detailLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            <span className="spinner" />
          </div>
        )}

        {!detailLoading && groups.length === 0 && (
          <p style={{ color: theme.muted, fontSize: '14px', textAlign: 'center', marginTop: '24px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            No activity logged for this venue yet
          </p>
        )}

        {!detailLoading && groups.map((group) => (
          <div key={group.dateLabel} style={{ marginTop: '16px' }}>
            <h4 style={{ color: theme.accent, fontSize: '13px', fontWeight: 700, marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              {group.dateLabel}
            </h4>
            {group.items.map((item) => (
              <div key={item.id} style={{
                backgroundColor: theme.surface2,
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '8px',
                display: 'flex',
                gap: '10px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  backgroundColor: theme.pill,
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User style={{ width: '16px', height: '16px', color: theme.bg }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: theme.text, fontSize: '14px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      {item.profiles?.display_name ?? 'Someone'}
                    </span>
                    {item.profiles?.is_verified && (
                      <BadgeCheck style={{ width: '14px', height: '14px', color: theme.accent }} />
                    )}
                  </div>
                  <p style={{ color: theme.text, fontSize: '15px', marginTop: '2px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    {item.content}
                  </p>
                  <p style={{ color: theme.muted, fontSize: '11px', marginTop: '6px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    {timeFormatter.format(new Date(item.created_at))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        History
      </h3>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && venues.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Clock style={{ width: '28px', height: '28px', color: theme.muted, margin: '0 auto 10px' }} />
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>No check-ins yet</p>
        </div>
      )}

      {!loading && venues.map((venue) => (
        <button
          key={venue.id}
          onClick={() => setSelectedVenue(venue)}
          style={{
            width: '100%',
            backgroundColor: theme.surface2,
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: theme.text, fontSize: '15px', fontWeight: 600 }}>{venue.name}</div>
            {venue.address && (
              <div style={{ color: theme.muted, fontSize: '12px', marginTop: '2px' }}>{venue.address}</div>
            )}
          </div>
          <ChevronRight style={{ width: '18px', height: '18px', color: theme.muted, flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}
