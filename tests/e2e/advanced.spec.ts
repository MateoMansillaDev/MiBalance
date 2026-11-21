import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { localInstance } from '../local-instance.mjs';

test('transferir, seguir una meta y personalizar la comparación entre meses', async ({
  page,
  context,
}) => {
  const local = localInstance();
  const email = randomUUID() + '@example.test',
    password = randomUUID();
  const link = await local.admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
  });
  if (!link.data.user || !link.data.properties)
    throw new Error('Falta la identidad de prueba.');
  try {
    await page.goto(
      '/auth/confirmar?token_hash=' +
        encodeURIComponent(link.data.properties.hashed_token),
    );
    await expect(
      page.getByRole('heading', { name: 'Resumen', exact: true }),
    ).toBeVisible();
    const db = local.publicClient();
    expect(
      (await db.auth.signInWithPassword({ email, password })).error,
    ).toBeNull();
    const account = await db.from('accounts').select('id').single();
    const category = await db
      .from('categories')
      .select('id')
      .eq('name', 'Sueldo')
      .single();
    if (!account.data || !category.data)
      throw new Error('Falta el catálogo de prueba.');
    expect(
      (await db.from('accounts').insert({ name: 'Ahorros', kind: 'bank' }))
        .error,
    ).toBeNull();
    expect(
      (
        await db.from('transactions').insert(
          [
            { occurred_on: '2024-01-31', amount_cents: 1200 },
            { occurred_on: '2024-02-29', amount_cents: 2301 },
          ].map((row) => ({
            ...row,
            type: 'income',
            account_id: account.data!.id,
            category_id: category.data!.id,
          })),
        )
      ).error,
    ).toBeNull();
    await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
    await page
      .getByRole('link', { name: 'Transferencias', exact: true })
      .click();
    await page
      .getByLabel('Cuenta de origen')
      .selectOption({ label: 'Efectivo' });
    await page
      .getByLabel('Cuenta de destino')
      .selectOption({ label: 'Ahorros' });
    await page.getByLabel('Importe', { exact: true }).fill('20,01');
    await page.getByLabel('Fecha', { exact: true }).fill('2024-02-29');
    await page.getByRole('button', { name: 'Registrar transferencia' }).click();
    await expect(page.getByText('Efectivo → Ahorros')).toBeVisible();
    await page.getByRole('link', { name: 'Ver saldos' }).click();
    await expect(
      page.locator('article').filter({ hasText: 'Ahorros' }),
    ).toContainText('20,01');
    await expect(
      page.locator('article').filter({ hasText: 'Efectivo' }),
    ).toContainText('15,00');
    await page
      .getByRole('link', { name: 'Planificación', exact: true })
      .click();
    await page.getByRole('link', { name: 'Metas de ahorro' }).click();
    await page
      .getByLabel('Cuenta para ahorrar')
      .selectOption({ label: 'Ahorros' });
    await page.getByLabel('Nombre de la meta').fill('Vacaciones');
    await page.getByLabel('Objetivo (en la moneda de la cuenta)').fill('20');
    await page.getByRole('button', { name: 'Crear meta' }).click();
    await expect(page.getByText(/Meta alcanzada/)).toBeVisible();
    await page.getByText('Editar meta').click();
    await page
      .locator('article')
      .getByLabel('Objetivo (en la moneda de la cuenta)')
      .fill('21');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText(/Faltan.*0,99/)).toBeVisible();
    await page.goto('/resumen?mes=2024-02');
    await expect(
      page
        .getByRole('row', { name: /Ingresos/ })
        .getByRole('cell')
        .last(),
    ).toContainText('11,01');
    await page.getByLabel('Mes de referencia').fill('2023-12');
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    await expect(
      page
        .getByRole('row', { name: /Ingresos/ })
        .getByRole('cell')
        .last(),
    ).toContainText('23,01');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const balances = page.getByRole('region', {
      name: 'Dinero en tus cuentas',
    });
    await expect(balances).toContainText('35,01');
    await expect(balances).toContainText('20,01');
    await balances.getByRole('button', { name: 'Ocultar importes' }).click();
    await expect(balances).not.toContainText('35,01');
    await expect(balances).not.toContainText('20,01');
    await page.reload();
    await expect(balances).toContainText('Importe oculto');
    await expect(balances).not.toContainText('35,01');
    await balances.getByRole('button', { name: 'Mostrar importes' }).click();
    await expect(balances).toContainText('35,01');
    await page.goto('/configuracion');
    await page.getByLabel('Mostrar comparativa mensual en Resumen').uncheck();
    await page.getByRole('button', { name: 'Guardar preferencia' }).click();
    await expect
      .poll(
        async () =>
          (await context.cookies()).find((c) => c.name === 'mb-compare')?.value,
      )
      .toBe('hide');
    await page.goto('/resumen');
    await expect(
      page.getByRole('heading', { name: 'Resumen', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Comparativa mensual' }),
    ).toHaveCount(0);
    await page.goto('/cuentas/transferencias');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Eliminar transferencia' }).click();
    await expect(
      page.getByText('No hay transferencias en esta página.'),
    ).toBeVisible();
    await page.goto('/planificacion/metas');
    await expect(page.getByText(/Faltan.*21,00/)).toBeVisible();
  } finally {
    expect(
      (await local.admin.auth.admin.deleteUser(link.data.user.id)).error,
    ).toBeNull();
  }
});

test('Chromium reconoce la PWA y sin red muestra una pantalla pública', async ({
  page,
  context,
}) => {
  await page.goto('/ingresar');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const session = await context.newCDPSession(page);
  const manifest = await session.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  expect(JSON.parse(manifest.data ?? '{}').display).toBe('standalone');
  expect(
    (await session.send('Page.getInstallabilityErrors')).installabilityErrors,
  ).toEqual([]);
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  await context.setOffline(true);
  const response = await page.goto('/cuentas');
  expect(response?.status()).toBe(503);
  await expect(
    page.getByRole('heading', { name: 'Necesitás conexión' }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link', { name: 'Reintentar' }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
});
