'use client';
import { useEffect } from 'react';
export function RegisterWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // El navegador puede deshabilitar workers en modo privado.
      });
    }
  }, []);
  return null;
}
