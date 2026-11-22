import { defineConfig } from '@playwright/test';
const baseURL = 'http://127.0.0.1:3187';
// Prueba la exportación estática (`npm run build` antes). Cada prueba usa un
// contexto nuevo del navegador, con su propio almacenamiento local vacío.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  workers: 1,
  use: { baseURL },
  projects: [
    { name: 'escritorio', use: { viewport: { width: 1360, height: 900 } } },
    {
      name: 'celular',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node tests/static-server.mjs',
    url: baseURL + '/resumen/',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
