'use client';
import { Suspense, useEffect } from 'react';

/** Título de la pestaña en pantallas cliente (la exportación estática no tiene metadata por página). */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title + ' · MiBalance';
  }, [title]);
}
/** Las pantallas que leen la URL necesitan un límite de Suspense en la exportación estática. */
export function withSuspense(Inner: () => React.ReactNode) {
  return function Page() {
    return (
      <Suspense fallback={null}>
        <Inner />
      </Suspense>
    );
  };
}
/** Parámetros de búsqueda como objeto plano. */
export function paramsOf(search: URLSearchParams) {
  return Object.fromEntries(search.entries());
}
