'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

// Mounted on the public landing page ("/"). Returning authenticated visitors
// are sent straight to the app; everyone else stays on the marketing page.
export default function AuthedRedirect() {
  const router = useRouter();
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) router.replace('/main');
  }, [isAuthenticated, router]);

  return null;
}
