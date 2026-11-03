'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Link2, X } from 'lucide-react';
import { useProfileSheet } from '@/lib/profileSheet';
import { getCurrentUserId } from '@/lib/auth';
import { fetchPublicProfile, fetchContactMethods, fetchUserVerificationTags, isConnectedTo } from '@/lib/data';
import type { Profile, ContactMethod, VerificationTag } from '@/lib/types';
import { LOOKING_FOR_OPTIONS } from '@/lib/constants';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import ContactGrid from '@/components/connect/ContactGrid';
import TagBadge from '@/components/shared/TagBadge';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';

// Read-only view of another person's public profile (profiles_public, which
// already nulls hidden fields). Opened from any avatar via openProfile().
// Founder rules: only Socializing/Networking intents show (never dating), and
// contact links + Message are for connections only.
export default function ProfileSheet() {
  const router = useRouter();
  const { userId, onMessage, close } = useProfileSheet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connected, setConnected] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [titles, setTitles] = useState<VerificationTag[]>([]);
  const [composing, setComposing] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setProfile(null);
    setConnected(false);
    setIsSelf(false);
    setMethods([]);
    setTitles([]);
    setComposing(false);
    setSent(false);
    setFailed(false);
    fetchPublicProfile(userId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setFailed(true); });
    getCurrentUserId().then((uid) => { if (!cancelled) setIsSelf(uid === userId); }).catch(() => {});
    isConnectedTo(userId)
      .then((c) => {
        if (cancelled) return;
        setConnected(c);
        if (c) fetchContactMethods(userId).then((m) => { if (!cancelled) setMethods(m); }).catch(() => {});
      })
      .catch(() => {});
    fetchUserVerificationTags(userId)
      .then((t) => {
        if (cancelled) return;
        // Same title at several venues shows once.
        const seen = new Set<string>();
        setTitles(t.filter((tag) => {
          const key = tag.type?.label ?? tag.tag;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [userId, close]);

  if (!userId) return null;

  const meta = profile
    ? [
        profile.age != null ? `${profile.age}` : null,
        profile.city_visible !== false ? profile.city : null,
        [profile.role, profile.affiliation].filter(Boolean).join(' at ') || null,
      ].filter(Boolean)
    : [];
  const pick = (options: { id: number; label: string }[], id?: number | null) =>
    id ? options.find((o) => o.id === id) : undefined;
  const hereFor = profile
    ? [
        pick(LOOKING_FOR_OPTIONS.socializing.options, profile.socialising_id) && 'Socializing',
        pick(LOOKING_FOR_OPTIONS.business.options, profile.networking_id) && 'Networking',
      ].filter((x): x is string => !!x)
    : [];
  const hasLinks = methods.some((m) => m.is_enabled && (m.value ?? '').trim() !== '');

  const label = { fontSize: 12, color: theme.muted, margin: '18px 0 8px' } as const;
  const chip = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999,
    border: `1px solid ${theme.glassBorder}`, background: theme.glassFill, fontSize: 13, color: theme.text,
  } as const;
  const primaryBtn = {
    flex: 1, padding: '12px', borderRadius: radius.control, border: 'none',
    background: theme.accent, color: theme.onAccent, fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: typeTokens.family,
  } as const;

  return (
    <div
      role="presentation"
      onClick={close}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 3000 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={profile?.display_name ? `${profile.display_name}'s profile` : 'Profile'}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '85dvh', overflowY: 'auto',
          backgroundColor: theme.surface, color: theme.text,
          borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          borderTop: `1px solid ${theme.glassBorder}`,
          padding: '12px 20px max(20px, env(safe-area-inset-bottom))', fontFamily: typeTokens.family,
          position: 'relative',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: theme.divider, margin: '0 auto 14px' }} />
        <button
          onClick={close}
          aria-label="Close"
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <X style={{ width: 20, height: 20 }} />
        </button>

        {failed ? (
          <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, padding: '24px 0' }}>Couldn&apos;t load this profile.</p>
        ) : !profile ? (
          <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, padding: '24px 0' }}>Loading…</p>
        ) : (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: 999, overflow: 'hidden', background: theme.pill,
              border: `2px solid ${theme.accent2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- matches existing avatar convention
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 30, fontWeight: 700 }}>{(profile.display_name ?? '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <h3 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 700 }}>{profile.display_name ?? 'Someone'}</h3>
              {profile.is_verified && <BadgeCheck size={18} color={theme.accent2} aria-label="Verified" />}
            </div>
            {meta.length > 0 && (
              <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, marginTop: 2 }}>{meta.join(' · ')}</p>
            )}
            {connected && (
              <p style={{ color: theme.accent2, fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Link2 size={14} aria-hidden /> Connected
              </p>
            )}

            {connected && hasLinks && (
              <>
                <div style={label}>Contact</div>
                <ContactGrid methods={methods} mode="readonly" />
              </>
            )}

            {hereFor.length > 0 && (
              <>
                <div style={label}>Here for</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {hereFor.map((h) => <span key={h} style={chip}>{h}</span>)}
                </div>
              </>
            )}

            {titles.length > 0 && (
              <>
                <div style={label}>Titles</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {titles.map((t) => <TagBadge key={t.id} tag={t} />)}
                </div>
              </>
            )}

            {!isSelf && (
              <div style={{ marginTop: 20 }}>
                {connected ? (
                  sent ? (
                    <p style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>Sent — find it in Messages.</p>
                  ) : composing ? (
                    <InlineMessageComposer recipient={profile} autoFocus onSent={() => { setComposing(false); setSent(true); }} />
                  ) : (
                    <div style={{ display: 'flex' }}>
                      <button
                        style={primaryBtn}
                        onClick={() => {
                          if (onMessage) { const fn = onMessage; close(); fn(); } else setComposing(true);
                        }}
                      >
                        Message
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <div style={{ display: 'flex' }}>
                      <button style={primaryBtn} onClick={() => { close(); router.push('/main/connect/scan'); }}>
                        Connect
                      </button>
                    </div>
                    <p style={{ color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                      Scan their code in person to connect. You can message once you&apos;re connected.
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
