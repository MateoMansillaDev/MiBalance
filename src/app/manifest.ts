import type { MetadataRoute } from 'next';
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
    background_color: '#102825',
    theme_color: '#102825',
    icons: [192, 512].map((size) => ({
      src: '/icons/mibalance-' + size + '.png',
      sizes: size + 'x' + size,
      type: 'image/png',
      purpose: 'any',
    })),
  };
}
