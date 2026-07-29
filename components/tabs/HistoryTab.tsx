'use client';

import { useState, useEffect } from 'react';
import { fetchLastVisited, fetchFeed, fetchAttendeeHistory } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, FeedItem, Profile } from '@/lib/types';
import { ChevronRight, Clock, User, BadgeCheck } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';

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

export default function HistoryTab() {
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
    setAttendees([]);
    setSelectedAttendeeId(null);
    fetchAttendeeHistory(selectedVenue.id)
      .then(setAttendees)
      .catch((err) => console.error('Failed to load attendee history:', err));
  }, [selectedVenue]);

  if (selectedVenue) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <HeroCarousel
          images={selectedVenue.banner_image ? [selectedVenue.banner_image] : []}
          title={selectedVenue.name}
          onBack={() => setSelectedVenue(null)}
        />

        <div style={{ padding: '16px 24px 24px' }}>
        {selectedVenue.address && (
          <p style={{ color: '#919191', fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {selectedVenue.address}
          </p>
        )}

        {attendees.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{
              color: '#919191',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Who was there</p>
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
              {attendees.map((attendee) => (
                <button
                  key={attendee.id}
                  onClick={() => setSelectedAttendeeId(attendee.id === selectedAttendeeId ? null : attendee.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    width: '56px'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: theme.pill,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: attendee.id === selectedAttendeeId ? `2px solid ${theme.accent}` : '2px solid transparent'
                  }}>
                    <span style={{ color: theme.bg, fontSize: '16px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      {(attendee.display_name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span style={{
                    color: 'white',
                    fontSize: '10px',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>{attendee.display_name ?? 'Someone'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {detailLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <span className="spinner" />
          </div>
        )}

        {!detailLoading && groups.length === 0 && (
          <p style={{
            color: '#919191',
            fontSize: '14px',
            textAlign: 'center',
            marginTop: '40px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>
            No activity logged for this venue yet
          </p>
        )}

        {!detailLoading && groups.map((group) => (
          <div key={group.dateLabel} style={{ marginTop: '20px' }}>
            <h3 style={{
              color: theme.accent,
              fontSize: '13px',
              fontWeight: 700,
              marginBottom: '8px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>{group.dateLabel}</h3>
            {group.items.map((item) => (
              <div key={item.id} style={{
                backgroundColor: theme.pill,
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
                  backgroundColor: '#F3F3F3',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User style={{ width: '16px', height: '16px', color: '#919191' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      color: theme.bg,
                      fontSize: '14px',
                      fontWeight: 600,
                      fontFamily: 'Montserrat, system-ui, sans-serif'
                    }}>{item.profiles?.display_name ?? 'Someone'}</span>
                    {item.profiles?.is_verified && (
                      <BadgeCheck style={{ width: '14px', height: '14px', color: theme.accent }} />
                    )}
                  </div>
                  <p style={{
                    color: theme.bg,
                    fontSize: '15px',
                    marginTop: '2px',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>{item.content}</p>
                  <p style={{
                    color: '#919191',
                    fontSize: '11px',
                    marginTop: '6px',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>{timeFormatter.format(new Date(item.created_at))}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '16px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #ED6BA1 0%, #EDB859 100%)',
        borderRadius: '16px',
        padding: '20px',
        minHeight: 'calc(100vh - 32px)'
      }}>
        <h1 style={{
          color: 'white',
          fontSize: '22px',
          fontWeight: 700,
          marginBottom: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>History</h1>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
            <span className="spinner" />
          </div>
        )}

        {!loading && venues.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Clock style={{ width: '32px', height: '32px', color: 'rgba(255,255,255,0.8)', margin: '0 auto 12px' }} />
            <p style={{
              color: 'white',
              fontSize: '15px',
              fontWeight: 500,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No check-ins yet</p>
          </div>
        )}

        {!loading && venues.map((venue) => (
          <button
            key={venue.id}
            onClick={() => setSelectedVenue(venue)}
            style={{
              width: '100%',
              backgroundColor: theme.pill,
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: theme.bg, fontSize: '16px', fontWeight: 600 }}>{venue.name}</div>
              {venue.address && (
                <div style={{ color: '#919191', fontSize: '13px', marginTop: '2px' }}>{venue.address}</div>
              )}
            </div>
            <ChevronRight style={{ width: '18px', height: '18px', color: '#919191', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}
