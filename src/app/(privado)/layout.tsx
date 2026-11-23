'use client';
import { useEffect } from 'react';
import { Shell } from '@/components/Shell';
import { PinLock } from '@/components/PinLock';
import { startStore, useStore } from '@/local/store';
import ui from '@/components/ui.module.scss';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const store = useStore();
  useEffect(() => {
    void startStore();
  }, []);
  if (store.status === 'loading')
    return (
      <p role="status" className={ui.empty}>
        Abriendo tus datos…
      </p>
    );
  if (store.status === 'error')
    return (
      <main className={ui.errorPage}>
        <h1>No pudimos abrir tus datos</h1>
        <p>{store.message}</p>
      </main>
    );
  return (
    <PinLock>
      <Shell>
        {store.saveError && (
          <p role="alert" className={ui.notice}>
            {store.saveError}
          </p>
        )}
        {children}
      </Shell>
    </PinLock>
  );
}
