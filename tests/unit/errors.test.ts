import { expect, it, vi, afterEach } from 'vitest';
import { authenticate } from '@/features/auth/actions';
import { historyFilters } from '@/features/ledger/filters';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  database: async () => ({ auth: { signInWithPassword: login } }),
}));
afterEach(() => vi.unstubAllEnvs());

it('informa el error de conexión del proveedor de identidad', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:55321');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'solo-prueba-unitaria');
  login.mockRejectedValueOnce(new TypeError('fetch failed'));
  const form = new FormData();
  form.set('email', 'prueba@example.test');
  form.set('password', 'solo-prueba-unitaria');
  expect((await authenticate(false, {}, form)).error).toMatch(/conectar con Supabase/);
});

it('rechaza rangos invertidos, fechas inexistentes e identificadores inválidos', () => {
  expect(historyFilters({ desde:'2024-03-01', hasta:'2024-02-29' }).invalid).toBe(true);
  expect(historyFilters({ hasta:'2024-02-30' }).invalid).toBe(true);
  expect(historyFilters({ cuenta:'invalida' }).invalid).toBe(true);
  expect(historyFilters({ desde:'2024-02-29', hasta:'2024-02-29' }).invalid).toBe(false);
});
