import type { NextConfig } from 'next';
// Exportación estática: la app corre entera en el navegador o dentro de la app
// Android, sin servidor propio. Los datos viven en el dispositivo.
const nextConfig: NextConfig = {
  output: 'export',
  // En GitHub Pages la app vive en una subcarpeta (ver .github/workflows/pages.yml).
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  agentRules: false,
  sassOptions: { implementation: 'sass-embedded' },
};
export default nextConfig;
