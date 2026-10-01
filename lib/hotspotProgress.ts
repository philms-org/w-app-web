// Pure hotspot-progress math. Dependency-free on purpose (type-only imports)
// so `node --test` can run it directly. See
// docs/superpowers/specs/2026-09-30-event-hotspots-design.md → "Visit rule".
import type { EventHotspot, HotspotCheckin, Reward } from './types';

export type EventWindow = { event_date?: string | null; event_end_date?: string | null };

export interface HotspotProgress {
  visited: Set<string>; // location_ids of visited hotspots
  count: number;
  total: number;
  target: number;
  nextReward: Reward | null;
  unlocked: Reward[];
}

// Calendar day in the runtime's local time zone — a check-in at 11:30pm on
// the event's last day must count even though it's the next day in UTC.
export function localDay(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function visitedHotspotIds(
  hotspots: EventHotspot[],
  checkins: HotspotCheckin[],
  window: EventWindow
): Set<string> {
  const byPlace = new Map(hotspots.map((h) => [h.location_id, h]));
  const start = window.event_date ? window.event_date.slice(0, 10) : null;
  const end = start ? (window.event_end_date ?? window.event_date)!.slice(0, 10) : null;
  const visited = new Set<string>();
  for (const c of checkins) {
    const h = byPlace.get(c.location_id);
    if (!h) continue;
    if (start && end) {
      const day = localDay(c.checked_in_at);
      if (day >= start && day <= end) visited.add(h.location_id);
    } else if (new Date(c.checked_in_at).getTime() >= new Date(h.created_at).getTime()) {
      visited.add(h.location_id);
    }
  }
  return visited;
}

export function computeHotspotProgress(input: {
  hotspots: EventHotspot[];
  checkins: HotspotCheckin[];
  window: EventWindow;
  rewards: Reward[];
}): HotspotProgress {
  const visited = visitedHotspotIds(input.hotspots, input.checkins, input.window);
  const count = visited.size;
  const total = input.hotspots.length;
  const tiers = input.rewards
    .filter((r): r is Reward & { min_hotspots: number } => r.is_active && r.min_hotspots != null)
    .sort((a, b) => a.min_hotspots - b.min_hotspots);
  const unlocked = tiers.filter((r) => count >= r.min_hotspots);
  const nextReward = tiers.find((r) => count < r.min_hotspots) ?? null;
  const target = nextReward ? nextReward.min_hotspots : total;
  return { visited, count, total, target, nextReward, unlocked };
}

export function hotspotMeterFill(p: HotspotProgress): number {
  if (p.target <= 0) return 0;
  return Math.max(0, Math.min(1, p.count / p.target));
}

// Which parent event a hotspot venue belongs to right now: one running today
// (local day within event_date..event_end_date), else an undated trail, else
// none — a past or future dated event never counts.
export function pickHotspotParent<T extends EventWindow>(events: T[], todayLocal: string): T | null {
  const running = events.find((e) => {
    const s = e.event_date?.slice(0, 10);
    if (!s) return false;
    const end = (e.event_end_date ?? e.event_date)!.slice(0, 10);
    return todayLocal >= s && todayLocal <= end;
  });
  return running ?? events.find((e) => !e.event_date) ?? null;
}
