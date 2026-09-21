'use client';

import { useState } from 'react';
import InAppBrowserModal from '@/components/ui/InAppBrowserModal';

// Throwaway verification harness for InAppBrowserModal — no auth required.
// Not linked from anywhere in the app. Delete before merging to main.
export default function BrowserModalTest() {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <button onClick={() => setUrl('https://example.com')}>Open embeddable (example.com)</button>
      <button onClick={() => setUrl('https://www.google.com')}>Open blocked (google.com)</button>
      {url && <InAppBrowserModal url={url} onClose={() => setUrl(null)} />}
    </div>
  );
}
