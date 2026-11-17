import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { localInstance } from '../local-instance.mjs';

test('registro, catálogos, movimientos, resumen, filtros y sesión', async ({
  page,
  context,
}) => {
  const email = 'ui-' + randomUUID() + '@example.test';
  const password = randomUUID();
  const instance = localInstance();
  const local = instance.publicClient();
  let userId: string | undefined;
  try {
    await page.goto('/cuentas');
    await expect(page).toHaveURL(/\/ingresar$/);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Correo electrónico')).toBeFocused();
    await page.getByRole('link', { name: 'Creá tu cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Creá tu cuenta' })).toBeVisible();
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(
      page.getByRole('heading', { name: 'Resumen', exact: true }),
    ).toBeVisible();
    userId = (await local.auth.signInWithPassword({ email, password })).data
      .user?.id;
    expect(userId).toBeTruthy();

    await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
    await page.getByRole('link', { name: 'Nueva cuenta' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Banco de prueba');
    await page.getByLabel('Tipo de cuenta').selectOption('bank');
    await page.getByLabel('Saldo inicial').fill('1.000,00');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Banco de prueba' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Categorías', exact: true }).click();
    await page.getByRole('link', { name: 'Nueva categoría' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Librería');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Librería' })).toBeVisible();

    await page.getByRole('link', { name: 'Agregar movimiento' }).click();
    await page.getByLabel('Importe').fill('0');
    await page
      .getByRole('combobox', { name: 'Cuenta', exact: true })
      .selectOption({ label: 'Banco de prueba' });
    await page
      .getByRole('combobox', { name: 'Categoría', exact: true })
      .selectOption({ label: 'Librería' });
    await page.getByLabel('Fecha', { exact: true }).fill('2024-02-29');
    await page.getByLabel('Descripción').fill('Libro de prueba');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('El importe debe ser mayor que cero.', {exact:true})).toBeVisible();
    await page.getByLabel('Importe').fill('123,45');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('link', { name: /Libro de prueba/ }).click();
    await page.getByLabel('Importe').fill('100,01');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(
      page.getByRole('link', { name: /Libro de prueba/ }),
    ).toContainText('100,01');

    await page.getByRole('link', { name: 'Agregar movimiento' }).click();
    await page.getByRole('radio', { name: 'Ingreso' }).check();
    await page.getByLabel('Importe').fill('200');
    await page
      .getByRole('combobox', { name: 'Cuenta', exact: true })
      .selectOption({ label: 'Banco de prueba' });
    await page
      .getByRole('combobox', { name: 'Categoría', exact: true })
      .selectOption({ label: 'Sueldo' });
    await page.getByLabel('Fecha', { exact: true }).fill('2024-02-01');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page).toHaveURL(/\/movimientos$/);
    await page.goto('/resumen?mes=2024-02');
    await expect(
      page.getByText('Saldo neto del mes').locator('../..'),
    ).toContainText('99,99');
    await expect(
      page.getByText('Gastos por categoría').locator('..'),
    ).toContainText('100,01');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('link', { name: 'Ver historial' }).click();
    await expect(
      page.getByRole('heading', { name: 'Historial (2)' }),
    ).toBeVisible();
    await page.getByLabel('Buscar en la descripción').fill('Libro');
    await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('expense');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(
      page.getByRole('heading', { name: 'Historial (1)' }),
    ).toBeVisible();
    await page.getByRole('link', { name: /Libro de prueba/ }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('button', { name: 'Conservar' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
    await expect(
      page.getByRole('link', { name: /Libro de prueba/ }),
    ).toHaveCount(0);
    await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
    await expect(
      page.getByRole('article').filter({ hasText: 'Banco de prueba' }),
    ).toContainText('1.200,00');
    await page.getByRole('link', { name: 'Editar Banco de prueba' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Banco renombrado');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('link', { name: 'Editar Banco renombrado' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'movimientos vinculados' })).toBeVisible();
    await page.getByRole('link', { name: 'Categorías', exact: true }).click();
    await page.getByRole('link', { name: 'Editar Librería' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('Libros');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('link', { name: 'Editar Libros' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
    await expect(page.getByRole('heading', { name: 'Libros' })).toHaveCount(0);
    await page
      .getByRole('link', { name: 'Configuración', exact: true })
      .click();
    await page.getByLabel('Tema').selectOption('dark');
    await page.getByRole('button', { name: 'Guardar preferencia' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Cerrar sesión' })
      .click();
    await expect(page).toHaveURL(/\/ingresar$/);
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/\/resumen$/);
    await context.clearCookies();
    await page.goto('/movimientos');
    await expect(page).toHaveURL(/\/ingresar$/);
  } finally {
    userId ??= (await local.auth.signInWithPassword({ email, password })).data
      .user?.id;
    if (userId)
      expect(
        (await instance.admin.auth.admin.deleteUser(userId)).error,
      ).toBeNull();
  }
});
