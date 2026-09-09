'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  fetchVerificationTagTypes, createVerificationTagType, updateVerificationTagType,
  deleteVerificationTagType, seedDefaultVerificationTagTypes, uploadTagIcon,
} from '@/lib/data';
import { TAG_ICON_CHOICES, resolveTagIcon } from '@/lib/tagIcons';
import type { VerificationTagType, TagIconKind } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

type Draft = { label: string; iconKind: TagIconKind; icon: string };
const EMPTY: Draft = { label: '', iconKind: 'lucide', icon: 'brain' };

export default function TagCatalogPanel({ locationId }: { locationId: string }) {
  const [types, setTypes] = useState<VerificationTagType[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetchVerificationTagTypes(locationId)
      .then(setTypes)
      .catch((e) => { console.error('Failed to load title catalog:', e); setError("Couldn't load titles."); });
  }, [locationId]);
  useEffect(() => { load(); }, [load]);

  const nextSort = useMemo(
    () => (types.length ? Math.max(...types.map((t) => t.sort_order)) + 10 : 10),
    [types],
  );

  const resetDraft = () => { setDraft(EMPTY); setEditingId(null); };

  const save = async () => {
    const label = draft.label.trim();
    if (!label) return;
    setBusy(true); setError(null);
    try {
      if (editingId) {
        await updateVerificationTagType(editingId, { label, icon_kind: draft.iconKind, icon: draft.icon });
      } else {
        await createVerificationTagType(locationId, {
          label, icon_kind: draft.iconKind, icon: draft.icon, sort_order: nextSort,
        });
      }
      resetDraft();
      load();
    } catch (e) {
      console.error('Failed to save title:', e);
      setError((e as Error).message || "Couldn't save the title.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true); setError(null);
    try { await deleteVerificationTagType(id); load(); }
    catch (e) { console.error('Failed to delete title:', e); setError("Couldn't delete the title."); }
    finally { setBusy(false); }
  };

  const seed = async () => {
    setBusy(true); setError(null);
    try { await seedDefaultVerificationTagTypes(locationId); load(); }
    catch (e) { console.error('Failed to seed defaults:', e); setError("Couldn't add the defaults."); }
    finally { setBusy(false); }
  };

  const onUpload = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const path = await uploadTagIcon(file, locationId);
      setDraft((d) => ({ ...d, iconKind: 'image', icon: path }));
    } catch (e) {
      console.error('Failed to upload icon:', e);
      setError((e as Error).message || "Couldn't upload the icon.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ fontFamily: typeTokens.family }}>
      <h2 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
        Title catalog
      </h2>
      {error && <p style={{ color: theme.accent2, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {types.length === 0 && (
        <button
          onClick={seed}
          disabled={busy}
          style={{
            marginBottom: 16, padding: '10px 16px', borderRadius: radius.pill, border: 'none',
            backgroundColor: theme.accent, color: '#0D0D0F', fontWeight: 700, cursor: 'pointer',
            fontFamily: typeTokens.family, fontSize: 14,
          }}
        >
          Start with common titles
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[...types].sort((a, b) => a.sort_order - b.sort_order).map((t) => {
          const Icon = resolveTagIcon(t.icon);
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 12,
              borderRadius: radius.card, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface,
            }}>
              <span style={{ width: 24, display: 'inline-flex', justifyContent: 'center' }}>
                {t.icon_kind === 'lucide' && <Icon style={{ width: 18, height: 18, color: theme.accent }} />}
                {t.icon_kind === 'emoji' && <span style={{ fontSize: 18 }}>{t.icon}</span>}
                {t.icon_kind === 'image' && <span style={{ fontSize: 11, color: theme.muted }}>IMG</span>}
              </span>
              <span style={{ flex: 1, fontWeight: 600, color: theme.text, fontSize: 14 }}>{t.label}</span>
              <button
                onClick={() => { setEditingId(t.id); setDraft({ label: t.label, iconKind: t.icon_kind, icon: t.icon }); }}
                style={{ background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Edit
              </button>
              <button onClick={() => remove(t.id)} disabled={busy} aria-label={`Delete ${t.label}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 style={{ width: 16, height: 16, color: theme.muted }} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{
        padding: 14, borderRadius: radius.card, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <p style={{ fontWeight: 700, color: theme.text, fontSize: 14 }}>
          {editingId ? 'Edit title' : 'Add title'}
        </p>
        <Input
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          placeholder="Title (e.g. Head Judge)"
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {(['lucide', 'emoji', 'image'] as TagIconKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                if (k === 'image') { fileRef.current?.click(); return; }
                setDraft((d) => ({ ...d, iconKind: k, icon: k === 'lucide' ? 'brain' : '' }));
              }}
              style={{
                padding: '6px 12px', borderRadius: radius.pill, cursor: 'pointer',
                border: `1px solid ${draft.iconKind === k ? theme.accent : theme.divider}`,
                backgroundColor: draft.iconKind === k ? theme.accent : 'transparent',
                color: draft.iconKind === k ? '#0D0D0F' : theme.text,
                fontFamily: typeTokens.family, fontSize: 13, fontWeight: 600,
              }}
            >
              {k === 'lucide' ? 'Icon' : k === 'emoji' ? 'Emoji' : 'Upload'}
            </button>
          ))}
          <input
            ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
          />
        </div>

        {draft.iconKind === 'emoji' && (
          <Input
            value={draft.icon}
            onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
            placeholder="🎧"
            maxLength={4}
            style={{ width: 80, textAlign: 'center' }}
          />
        )}
        {draft.iconKind === 'image' && (
          <p style={{ fontSize: 12, color: theme.muted }}>
            {draft.icon ? 'Image uploaded.' : 'Tap "Upload" to choose an image (PNG/JPG/WebP/SVG, ≤512 KB).'}
          </p>
        )}
        {draft.iconKind === 'lucide' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {TAG_ICON_CHOICES.map((name) => {
              const Icon = resolveTagIcon(name);
              const on = draft.icon === name;
              return (
                <button
                  key={name}
                  onClick={() => setDraft((d) => ({ ...d, icon: name }))}
                  aria-label={name}
                  style={{
                    width: 40, height: 40, borderRadius: radius.control, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${on ? theme.accent : theme.divider}`,
                    backgroundColor: on ? theme.accent : 'transparent',
                  }}
                >
                  <Icon style={{ width: 18, height: 18, color: on ? '#0D0D0F' : theme.text }} />
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={save} disabled={busy || !draft.label.trim()}>
            {editingId ? 'Save' : 'Add'}
          </Button>
          {editingId && (
            <button onClick={resetDraft} style={{ background: 'none', border: 'none', color: theme.muted, cursor: 'pointer', fontFamily: typeTokens.family, fontSize: 13 }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
