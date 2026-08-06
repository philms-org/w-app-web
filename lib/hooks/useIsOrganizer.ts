import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { fetchVenue, fetchLocationManagers } from '@/lib/data';

// Organizer status is per-venue: either Venue.owner_id (the primary owner)
// or a location_managers row (a co-owner). Master-admin is global
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
    Promise.all([fetchVenue(locationId), fetchLocationManagers(locationId)])
      .then(([venue, managers]) => {
        if (cancelled) return;
        const isOwner = venue?.owner_id === user.id;
        const isCoOwner = managers.some((m) => m.user_id === user.id);
        setIsOrganizer(isOwner || isCoOwner);
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
