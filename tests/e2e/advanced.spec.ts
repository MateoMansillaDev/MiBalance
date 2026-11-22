import { test, expect } from '@playwright/test';
import { addMovement, newAccount, open } from './helpers';

test('transferir, metas, comparación, saldos ocultos, cuotas, dólares y PIN', async ({
  page,
  context,
}) => {
  await open(page);
  await newAccount(page, 'Ahorros', 'bank');
  for (const [date, amount] of [
    ['2024-01-31', '12,00'],
    ['2024-02-29', '23,01'],
  ])
    await addMovement(page, { income: true, amount, account: 'Efectivo', category: 'Sueldo', date });

  // Transferencia: cambia los saldos sin tocar ingresos ni gastos.
  await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
  await page.getByRole('link', { name: 'Transferencias', exact: true }).click();
  await page.getByLabel('Cuenta de origen').selectOption({ label: 'Efectivo' });
  await page.getByLabel('Cuenta de destino').selectOption({ label: 'Ahorros' });
  await page.getByLabel('Importe', { exact: true }).fill('20,01');
  await page.getByLabel('Fecha', { exact: true }).fill('2024-02-29');
  await page.getByRole('button', { name: 'Registrar transferencia' }).click();
  await expect(page.getByText('Efectivo → Ahorros')).toBeVisible();
  await page.getByRole('link', { name: 'Ver saldos' }).click();
  await expect(page.locator('article').filter({ hasText: 'Ahorros' })).toContainText('20,01');
  await expect(page.locator('article').filter({ hasText: 'Efectivo' })).toContainText('15,00');

  // Meta de ahorro.
  await page.getByRole('link', { name: 'Planificación', exact: true }).click();
  await page.getByRole('link', { name: 'Metas de ahorro' }).click();
  await page.getByLabel('Cuenta para ahorrar').selectOption({ label: 'Ahorros' });
  await page.getByLabel('Nombre de la meta').fill('Vacaciones');
  await page.getByLabel('Objetivo (en la moneda de la cuenta)').fill('20');
  await page.getByRole('button', { name: 'Crear meta' }).click();
  await expect(page.getByText(/Meta alcanzada/)).toBeVisible();
  await page.getByText('Editar meta').click();
  await page.locator('article').getByLabel('Objetivo (en la moneda de la cuenta)').fill('21');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(/Faltan.*0,99/)).toBeVisible();

  // Comparativa entre meses.
  await page.goto('/resumen/?mes=2024-02');
  await expect(page.getByRole('row', { name: /Ingresos/ }).getByRole('cell').last()).toContainText('11,01');
  await page.getByLabel('Mes de referencia').fill('2023-12');
  await page.getByRole('button', { name: 'Comparar', exact: true }).click();
  await expect(page.getByRole('row', { name: /Ingresos/ }).getByRole('cell').last()).toContainText('23,01');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Saldos ocultos, recordados al recargar.
  const balances = page.getByRole('region', { name: 'Dinero en tus cuentas' });
  await expect(balances).toContainText('35,01');
  await balances.getByRole('button', { name: 'Ocultar importes' }).click();
  await expect(balances).not.toContainText('35,01');
  await page.reload();
  await expect(balances).toContainText('Importe oculto');
  await expect(balances).not.toContainText('35,01');
  await balances.getByRole('button', { name: 'Mostrar importes' }).click();
  await expect(balances).toContainText('35,01');

  // Compra en cuotas con tarjeta.
  await newAccount(page, 'Visa', 'credit');
  await addMovement(page, {
    amount: '30,00',
    account: 'Visa',
    category: 'Hogar',
    date: '2024-01-15',
    description: 'Heladera',
    installments: '3 cuotas',
  });
  await expect(page.getByRole('link', { name: /Heladera/ })).toHaveCount(3);
  await expect(page.getByText(/Cuota 3\/3/)).toBeVisible();
  await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
  await page.getByRole('link', { name: 'Tarjetas', exact: true }).click();
  await expect(page.locator('article').filter({ hasText: 'Visa' })).toContainText('30,00');
  await page.getByRole('link', { name: 'Movimientos', exact: true }).click();
  await page.getByRole('link', { name: /Heladera/ }).first().click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Eliminar la compra completa' }).click();
  await expect(page).toHaveURL(/\/movimientos\/?$/);
  await expect(page.getByRole('link', { name: /Heladera/ })).toHaveCount(0);

  // Dólares: cotización de referencia y compra, sin cambiar el total estimado.
  await newAccount(page, 'Dólares', 'cash', 'USD');
  await page.getByLabel('Pesos por US$ 1').fill('1.000,00');
  await page.getByRole('button', { name: 'Guardar cotización' }).click();
  await expect(page.getByText(/Actualizada el/)).toBeVisible();
  await page.getByRole('link', { name: 'Compra y venta de dólares' }).click();
  await page.getByLabel('Sale de').selectOption({ label: 'Efectivo (ARS)' });
  await page.getByLabel('Entra en').selectOption({ label: 'Dólares (USD)' });
  await page.getByLabel('Importe que sale').fill('10,00');
  await page.getByLabel('Importe que entra').fill('0,01');
  await page.getByRole('button', { name: 'Registrar operación' }).click();
  await expect(page.getByText(/1\.000,00 por US\$ 1/)).toBeVisible();
  await page.getByRole('link', { name: 'Resumen', exact: true }).click();
  await expect(balances).toContainText('35,01');
  await expect(balances).toContainText('US$');

  // Preferencia de comparativa.
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('Mostrar comparativa mensual en Resumen').uncheck();
  await page.getByRole('button', { name: 'Guardar preferencia' }).click();
  await page.getByRole('link', { name: 'Resumen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comparativa mensual' })).toHaveCount(0);

  // PIN: otra pestaña lo pide; un PIN incorrecto no desbloquea.
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('PIN (4 a 8 números)').fill('2468');
  await page.getByLabel('Repetí el PIN').fill('2468');
  await page.getByRole('button', { name: 'Activar PIN' }).click();
  await expect(page.getByText('PIN guardado en este dispositivo.')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/resumen/');
  await expect(other.getByRole('heading', { name: 'MiBalance está bloqueado' })).toBeVisible();
  await expect(other.getByText('35,01')).toHaveCount(0);
  await other.getByLabel('PIN', { exact: true }).fill('1357');
  await other.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(other.getByText('PIN incorrecto.')).toBeVisible();
  await other.getByLabel('PIN', { exact: true }).fill('2468');
  await other.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(other.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();

  // Transferencia eliminada: revierte el saldo de las dos cuentas.
  await page.goto('/cuentas/transferencias/');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Eliminar transferencia' }).click();
  await expect(page.getByText('No hay transferencias en esta página.')).toBeVisible();
  await page.goto('/planificacion/metas/');
  await expect(page.getByText(/Faltan.*21,00/)).toBeVisible();
});

test('Chromium reconoce la PWA y abre los datos sin conexión', async ({ page, context }) => {
  await open(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
  const session = await context.newCDPSession(page);
  const manifest = await session.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  expect(JSON.parse(manifest.data ?? '{}').display).toBe('standalone');
  expect((await session.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Resumen', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Dinero en tus cuentas' })).toContainText('Efectivo');
  await context.setOffline(false);
});
