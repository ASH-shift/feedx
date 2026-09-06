'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

// Separate client component to call hydrate() on mount without affecting layout SSR
export default function AuthHydrator() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}
