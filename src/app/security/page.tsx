'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SecurityPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/admin/logs');
  }, [router]);

  return null;
}
