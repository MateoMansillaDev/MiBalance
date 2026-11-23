import { expect, type Page } from '@playwright/test';

export async function open(page: Page, path = '/resumen/') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}
export async function addMovement(
  page: Page,
  m: {
    income?: boolean;
    amount: string;
    account: string;
    category: string;
    date: string;
    description?: string;
    installments?: string;
  },
) {
  await page.getByRole('link', { name: 'Agregar movimiento' }).click();
  await expect(page.getByRole('heading', { name: 'Agregar movimiento' })).toBeVisible();
  if (m.income) await page.getByRole('radio', { name: 'Ingreso' }).check();
  await page.getByRole('combobox', { name: 'Cuenta', exact: true }).selectOption({ label: m.account });
  await page.getByLabel(/^Importe/).fill(m.amount);
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: m.category });
  if (m.installments) await page.getByLabel('Cantidad de cuotas').selectOption({ label: m.installments });
  await page.getByLabel(/^Fecha/).fill(m.date);
  if (m.description) await page.getByLabel('Descripción').fill(m.description);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page).toHaveURL(/\/movimientos\/?$/);
}
export async function newAccount(page: Page, name: string, kind?: string, currency?: string) {
  await page.getByRole('link', { name: 'Cuentas', exact: true }).click();
  await page.getByRole('link', { name: 'Nueva cuenta' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  if (kind) await page.getByLabel('Tipo de cuenta').selectOption(kind);
  if (currency) await page.locator('select[name="currency"]').selectOption(currency);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
