import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { localInstance } from '../local-instance.mjs';
import { today } from '../../src/lib/dates';

test('presupuesto, recurrencia, CSV y reporte guardado', async ({ page }) => {
  const { admin } = localInstance();
  const link = await admin.auth.admin.generateLink({
    type: 'signup',
    email: 'plan-ui-' + randomUUID() + '@example.test',
    password: randomUUID(),
  });
  if (link.error || !link.data.properties || !link.data.user)
    throw new Error('Falta el usuario de prueba.');
  const date = today();
  try {
    await page.goto(
      '/auth/confirmar?token_hash=' +
        encodeURIComponent(link.data.properties.hashed_token),
    );
    await page
      .getByRole('link', { name: 'Planificación', exact: true })
      .click();
    await page.getByText('Definir o actualizar un límite').click();
    await page
      .getByRole('combobox', { name: 'Categoría de gasto' })
      .selectOption({ label: 'Hogar' });
    await page.getByLabel('Límite mensual').fill('100,00');
    await page.getByRole('button', { name: 'Guardar presupuesto' }).click();
    await expect(page.getByText('Dentro del presupuesto')).toBeVisible();
    await page.getByText('Programar una repetición').click();
    await page
      .getByRole('combobox', { name: 'Categoría', exact: true })
      .selectOption({ label: 'Hogar' });
    await page.getByLabel('Importe (ARS)', { exact: true }).fill('80');
    await page.getByLabel('Descripción (opcional)').fill('Servicio recurrente');
    await page.getByRole('button', { name: 'Programar movimiento' }).click();
    await expect(page.getByText('Alcanzaste el 80 %')).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Servicio recurrente', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Movimientos', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Historial (1)' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Importar CSV' }).click();
    const header = 'id;fecha;tipo;importe;cuenta;categoria;descripcion';
    const line = ';' + date + ';gasto;20,25;Efectivo;Hogar;Compra importada';
    await page
      .getByLabel('Archivo CSV')
      .setInputFiles({
        name: 'archivo.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from([header, line, line].join('\r\n')),
      });
    await page.getByRole('button', { name: 'Ver vista previa' }).click();
    await expect(
      page.getByRole('cell', { name: 'Duplicado', exact: true }),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Confirmar importación' }).click();
    await expect(
      page.getByText('Importados: 1. Duplicados omitidos: 1.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Volver al historial' }).click();
    await page.getByLabel('Buscar en la descripción').fill('Compra importada');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(
      page.getByRole('heading', { name: 'Historial (1)' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Reporte del historial' }),
    ).toContainText('20,25');
    await page.getByText('Filtros guardados (0)').click();
    await page.getByLabel('Nombre del filtro').fill('Compras');
    await page
      .getByRole('button', { name: 'Guardar filtros actuales' })
      .click();
    await expect(
      page.getByRole('link', { name: 'Compras', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Limpiar', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Historial (2)' }),
    ).toBeVisible();
    const saved = page.getByRole('link', { name: 'Compras', exact: true });
    if (!(await saved.isVisible()))
      await page.getByText('Filtros guardados (1)').click();
    await saved.click();
    await expect(page.getByLabel('Buscar en la descripción')).toHaveValue(
      'Compra importada',
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Exportar CSV' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    if (!stream) throw new Error('Falta la descarga.');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks);
    expect(csv.toString()).toContain('Compra importada');
    expect(csv.toString()).not.toContain('Servicio recurrente');
    await page.getByRole('link', { name: 'Importar CSV' }).click();
    await page
      .getByLabel('Archivo CSV')
      .setInputFiles({
        name: 'exportado.csv',
        mimeType: 'text/csv',
        buffer: csv,
      });
    await page.getByRole('button', { name: 'Ver vista previa' }).click();
    await expect(
      page.getByRole('cell', { name: 'Duplicado', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Confirmar importación' }),
    ).toBeDisabled();
    await page.getByRole('link', { name: 'Resumen', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Alertas de presupuesto' }),
    ).toContainText('Límite superado');
    await page.getByRole('link', { name: 'Revisar presupuestos' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Finalizar repetición' }).click();
    await expect(
      page.getByText('Todavía no programaste movimientos recurrentes.'),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    expect(
      (await admin.auth.admin.deleteUser(link.data.user.id)).error,
    ).toBeNull();
  }
});
