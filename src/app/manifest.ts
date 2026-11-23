import type { MetadataRoute } from 'next';
// La exportación estática necesita que el manifest se genere una sola vez al compilar.
export const dynamic = 'force-static';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MiBalance',
    short_name: 'MiBalance',
    lang: 'es-AR',
    description: 'Ingresos, gastos y saldos personales en pesos argentinos.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f3ff',
    theme_color: '#6d3fe0',
    icons: [192, 512].map((size) => ({
      src: '/icons/mibalance-' + size + '.png',
      sizes: size + 'x' + size,
      type: 'image/png',
      purpose: 'any',
    })),
  };
}
