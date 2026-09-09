import type { LucideIcon } from 'lucide-react';
import {
  Phone, Mail, Instagram, MessageCircle, Linkedin, Ghost, Twitter, Send, Globe, Link2,
} from 'lucide-react';

export interface ContactTypeMeta {
  type: string;
  label: string;
  icon: LucideIcon;
  hint: string;
  buildLink: (value: string) => string | null;
}

const digits = (v: string) => v.replace(/[^\d]/g, '');
const stripAt = (v: string) => v.replace(/^@+/, '').trim();
const stripHost = (v: string, host: string) =>
  v.trim().replace(/^https?:\/\//i, '').replace(new RegExp(`^${host}/?`, 'i'), '').replace(/^@+/, '');

export const CONTACT_TYPES: ContactTypeMeta[] = [
  { type: 'phone', label: 'Phone', icon: Phone, hint: '+1 555 123 4567',
    buildLink: (v) => (digits(v) ? `tel:${v.trim().startsWith('+') ? '+' : ''}${digits(v)}` : null) },
  { type: 'email', label: 'Email', icon: Mail, hint: 'you@example.com',
    buildLink: (v) => (v.trim() ? `mailto:${v.trim()}` : null) },
  { type: 'instagram', label: 'Instagram', icon: Instagram, hint: '@handle',
    buildLink: (v) => (stripAt(v) ? `https://instagram.com/${stripHost(v, 'instagram.com')}` : null) },
  { type: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, hint: '+1 555 123 4567',
    buildLink: (v) => (digits(v) ? `https://wa.me/${digits(v)}` : null) },
  { type: 'linkedin', label: 'LinkedIn', icon: Linkedin, hint: 'in/your-name',
    buildLink: (v) => (v.trim() ? `https://linkedin.com/${stripHost(v, 'linkedin.com')}` : null) },
  { type: 'snapchat', label: 'Snapchat', icon: Ghost, hint: 'username',
    buildLink: (v) => (stripAt(v) ? `https://snapchat.com/add/${stripAt(v)}` : null) },
  { type: 'x', label: 'X', icon: Twitter, hint: '@handle',
    buildLink: (v) => (stripAt(v) ? `https://x.com/${stripHost(v, 'x.com')}` : null) },
  { type: 'telegram', label: 'Telegram', icon: Send, hint: 'username',
    buildLink: (v) => (stripAt(v) ? `https://t.me/${stripAt(v)}` : null) },
  { type: 'website', label: 'Website', icon: Globe, hint: 'example.com',
    buildLink: (v) => {
      const t = v.trim();
      if (!t) return null;
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    } },
  { type: 'custom', label: 'Custom', icon: Link2, hint: 'anything',
    buildLink: () => null },
];

const FALLBACK = (type: string): ContactTypeMeta => ({
  type, label: type, icon: Link2, hint: '', buildLink: () => null,
});

export function contactTypeMeta(type: string): ContactTypeMeta {
  return CONTACT_TYPES.find((c) => c.type === type) ?? FALLBACK(type);
}

export function contactLink(type: string, value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  return contactTypeMeta(type).buildLink(v);
}

export const DEFAULT_SLOTS: string[] = ['phone', 'email', 'instagram', 'whatsapp', 'linkedin', 'custom'];
