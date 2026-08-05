import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { fetchVenue } from '@/lib/data';

// Organizer status is per-venue (Venue.owner_id), master-admin is global
// (profiles.is_master_admin). RLS is the real enforcement; this hook only
// controls what renders.
export function useIsOrganizer(locationId: string | null | undefined) {
  const { user } = useStore();
  const isMasterAdmin = !!user?.isMasterAdmin;
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    if (!locationId || !user) {
      setIsOrganizer(false);
      return;
    }

    let cancelled = false;
    fetchVenue(locationId)
      .then((venue) => {
        if (!cancelled) setIsOrganizer(venue?.owner_id === user.id);
      })
      .catch(() => {
        if (!cancelled) setIsOrganizer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId, user]);

  return { isOrganizer, isMasterAdmin, canManage: isOrganizer || isMasterAdmin };
}
