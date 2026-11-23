'use client';
import { useEffect } from 'react';
import { BASE } from '@/lib/base';
export function RegisterWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' }).catch(() => {
        // El navegador puede deshabilitar workers en modo privado.
      });
    }
  }, []);
  return null;
}
