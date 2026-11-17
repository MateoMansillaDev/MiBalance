import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { localInstance } from '../local-instance.mjs';

test('confirma una cuenta y exige volver a ingresar cuando Auth invalida la identidad', async ({ page }) => {
  const { admin } = localInstance();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: 'confirmacion-' + randomUUID() + '@example.test',
    password: randomUUID(),
  });
  expect(error).toBeNull();
  if (!data.user || !data.properties) throw new Error('Falta el enlace de prueba.');
  let removed = false;
  try {
    await page.goto('/auth/confirmar?token_hash=' + encodeURIComponent(data.properties.hashed_token));
    await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
    expect((await admin.auth.admin.deleteUser(data.user.id)).error).toBeNull();
    removed = true;
    await page.goto('/movimientos');
    await expect(page).toHaveURL(/\/ingresar$/);
    await page.goto('/auth/confirmar?token_hash=invalido');
    await expect(page.getByText(/El enlace de confirmación venció/)).toBeVisible();
  } finally {
    if (!removed) await admin.auth.admin.deleteUser(data.user.id);
  }
});
