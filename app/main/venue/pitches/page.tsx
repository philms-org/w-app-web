'use client';

import VenueToolPage from '@/components/organizer/VenueToolPage';
import PitchesView from '@/components/venue/PitchesView';

export default function VenuePitchesPage() {
  return (
    <VenueToolPage title="Pitches">
      {(locationId) => <PitchesView locationId={locationId} />}
    </VenueToolPage>
  );
}
