'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/resumen/');
  }, [router]);
  return (
    <p style={{ padding: '2rem' }}>
      <Link href="/resumen/">Abrir MiBalance</Link>
    </p>
  );
}
