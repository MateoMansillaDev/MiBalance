import { defineConfig } from '@playwright/test';
import { localInstance } from './tests/local-instance.mjs';
const local = localInstance();
const baseURL = 'http://127.0.0.1:3187';
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
    command: 'npm run start -- --hostname 127.0.0.1 --port 3187',
    url: baseURL + '/ingresar',
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: local.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.key,
    },
    timeout: 60000,
  },
});
