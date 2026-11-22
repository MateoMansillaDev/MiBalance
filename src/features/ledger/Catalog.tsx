'use client';
import Link from 'next/link';
import {
  Banknote,
  CreditCard,
  Landmark,
  Wallet,
  Plus,
  Pencil,
} from 'lucide-react';
import { Heading } from '@/components/Heading';
import { MutationForm } from '@/components/MutationForm';
import { useBook } from '@/local/store';
import { accountBalances, categoryList } from '@/local/views';
import { CatalogEditor } from './Editor';
import { saveRate } from '@/local/actions';
import { currencies, directions, kinds } from '@/lib/domain';
import { categoryColor, iconSet } from '@/lib/categoryIcons';
import { dateLabel } from '@/lib/dates';
import { decimal, money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
const icons = {
  cash: Banknote,
  bank: Landmark,
  wallet: Wallet,
  credit: CreditCard,
};
export function Catalog({
  finance,
  edit,
  create,
}: {
  finance: boolean;
  edit?: string;
  create: boolean;
}) {
  const book = useBook();
  const rows = finance ? accountBalances(book) : categoryList(book);
  const rate = finance ? book.rate() : null;
  const selected = edit ? rows.find((row) => row.id === edit) : undefined;
  if (edit && !selected)
    return (
      <p role="alert" className={ui.notice}>
        Ese registro ya no está disponible.{' '}
        <Link href={finance ? '/cuentas' : '/categorias'}>Volver</Link>
      </p>
    );
  const base = finance ? '/cuentas' : '/categorias';
  const noun = finance ? 'cuenta' : 'categoría';
  return (
    <>
      <Heading
        title={finance ? 'Cuentas' : 'Categorías'}
        description={
          finance
            ? 'Saldo disponible en cada cuenta, incluido su saldo inicial.'
            : 'Organizá tus ingresos y gastos por categoría.'
        }
      >
        {finance && (
          <>
            <Link href="/cuentas/transferencias" className={ui.secondary}>
              Transferencias
            </Link>
            <Link href="/cuentas/tarjetas" className={ui.secondary}>
              Tarjetas
            </Link>
            <Link href="/cuentas/dolares" className={ui.secondary}>
              Compra y venta de dólares
            </Link>
          </>
        )}
        <Link className={ui.secondary} href={base + '?nueva=1'}>
          <Plus size={16} /> Nueva {noun}
        </Link>
      </Heading>
      {(create || selected) && (
        <CatalogEditor
          key={selected?.id ?? 'new'}
          resource={finance ? 'accounts' : 'categories'}
          item={selected}
        />
      )}
      {finance && (
        <section className={[ui.panel, ui.sectionGap].join(' ')}>
          <h2>Cotización de referencia del dólar</h2>
          <p>
            {rate
              ? 'Actualizada el ' +
                dateLabel(rate.updated_on) +
                ': ' +
                money(rate.ars_cents_per_usd) +
                ' por US$ 1. Se usa solo para estimar en pesos tus cuentas en dólares.'
              : 'Cargá cuántos pesos vale un dólar para estimar en pesos tus cuentas en dólares.'}
          </p>
          <MutationForm action={saveRate} submit="Guardar cotización">
            <label>
              Pesos por US$ 1
              <input
                name="ars_cents_per_usd"
                inputMode="decimal"
                required
                defaultValue={rate ? decimal(rate.ars_cents_per_usd) : ''}
              />
            </label>
          </MutationForm>
        </section>
      )}
      <div className={[ui.catalog, ui.sectionGap].join(' ')}>
        {rows.map((row) => {
          const account = 'kind' in row ? row : undefined;
          const category = 'type' in row ? row : undefined;
          const Icon = account
            ? icons[account.kind]
            : iconSet[category?.icon ?? 'tag'].icon;
          const tint = category
            ? categoryColor(category.name, category.color)
            : undefined;
          return (
            <article key={row.id} className={ui.panel}>
              <div className={ui.between}>
                <span
                  className={ui.tile}
                  style={tint ? { background: tint, color: '#fff' } : undefined}
                >
                  <Icon size={21} />
                </span>
                <Link
                  className={ui.iconLink}
                  aria-label={'Editar ' + row.name}
                  href={base + '?editar=' + row.id}
                >
                  <Pencil size={16} />
                </Link>
              </div>
              <h2>{row.name}</h2>
              <p>
                {category
                  ? directions[category.type]
                  : account &&
                    kinds[account.kind] +
                      (account.currency === 'USD'
                        ? ' · ' + currencies.USD
                        : '')}
              </p>
              {account && (
                <strong className={ui.figure}>
                  {money(account.balance_cents, account.currency)}
                </strong>
              )}
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <p className={ui.empty}>
          Todavía no hay {finance ? 'cuentas' : 'categorías'}. Creá la primera
          para cargar movimientos.
        </p>
      )}
    </>
  );
}
