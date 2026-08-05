'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useStore();
  const isMasterAdmin = !!user?.isMasterAdmin;

  useEffect(() => {
    if (!isAuthenticated || !isMasterAdmin) {
      router.push('/main');
    }
  }, [isAuthenticated, isMasterAdmin, router]);

  if (!isAuthenticated || !isMasterAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
