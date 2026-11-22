import type { NextConfig } from 'next';
// Exportación estática: la app corre entera en el navegador o dentro de la app
// Android, sin servidor propio. Los datos viven en el dispositivo.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  agentRules: false,
  sassOptions: { implementation: 'sass-embedded' },
};
export default nextConfig;
