import { theme } from '@/lib/theme';

// Marks someone on a venue's guest pass (migration 0037): investors /
// sponsors following remotely. Also labels the guest pass section for
// organizers.
export default function GuestBadge({ label = 'Guest' }: { label?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999,
      background: theme.pill, color: theme.text, border: `1px solid ${theme.glassBorder}`,
      fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
