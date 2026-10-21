'use client';

import { useState } from 'react';
import type { ContactMethod } from '@/lib/types';
import { CONTACT_TYPES, contactTypeMeta } from '@/lib/contact-methods';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

interface EditLinkSheetProps {
  slotOrder: number;
  existing: ContactMethod | null;
  onSave: (patch: { slot_order: number; type: string; value: string; is_enabled: boolean }) => Promise<void>;
  onClose: () => void;
}

export default function EditLinkSheet({ slotOrder, existing, onSave, onClose }: EditLinkSheetProps) {
  const [type, setType] = useState(existing?.type ?? CONTACT_TYPES[0].type);
  const [value, setValue] = useState(existing?.value ?? '');
  const [enabled, setEnabled] = useState(existing?.is_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed && enabled) {
      setError('Add something first, or turn this one off.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ slot_order: slotOrder, type, value: trimmed, is_enabled: enabled });
      onClose();
    } catch (err) {
      // Previously swallowed, so a failed save looked like nothing happened.
      console.error('Failed to save link:', err);
      const msg = (err as { message?: string })?.message ?? '';
      setError(msg ? `Couldn't save: ${msg}` : "Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', backgroundColor: theme.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          padding: '20px 20px max(20px, env(safe-area-inset-bottom))', fontFamily: typeTokens.family,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h3 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Edit link</h3>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONTACT_TYPES.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => setType(c.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: radius.pill,
                border: `1px solid ${type === c.type ? theme.accent : theme.divider}`,
                backgroundColor: type === c.type ? theme.accent : theme.surface,
                color: type === c.type ? theme.onAccent : theme.text,
                fontSize: typeTokens.label.fontSize, fontWeight: 600, cursor: 'pointer', fontFamily: typeTokens.family,
              }}
            >
              <c.icon style={{ width: 14, height: 14 }} />
              {c.label}
            </button>
          ))}
        </div>

        <Input
          label="Value"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          placeholder={contactTypeMeta(type).hint}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode={type === 'phone' || type === 'whatsapp' ? 'tel' : type === 'email' ? 'email' : type === 'website' || type === 'linkedin' ? 'url' : 'text'}
        />
        {error && (
          <p role="alert" style={{ color: theme.accent2, fontSize: typeTokens.label.fontSize, margin: 0 }}>{error}</p>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: theme.text, fontSize: typeTokens.label.fontSize, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18, accentColor: theme.accent }} />
          Show this to people I connect with
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
}
