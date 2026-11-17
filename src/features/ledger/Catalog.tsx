import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banknote, Landmark, Wallet, Tag, Plus, Pencil } from 'lucide-react';
import { Heading } from '@/components/Heading';
import { accounts, categories } from './queries';
import { CatalogEditor } from './Editor';
import { directions, kinds } from '@/lib/domain';
import { money } from '@/lib/money';
import ui from '@/components/ui.module.scss';
const icons = { cash: Banknote, bank: Landmark, wallet: Wallet };
export async function Catalog({
  finance,
  edit,
  create,
}: {
  finance: boolean;
  edit?: string;
  create: boolean;
}) {
  const rows = finance ? await accounts() : await categories();
  const selected = edit ? rows.find((row) => row.id === edit) : undefined;
  if (edit && !selected) notFound();
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
      <div className={ui.catalog}>
        {rows.map((row) => {
          const account = 'kind' in row ? row : undefined;
          const Icon = account ? icons[account.kind] : Tag;
          return (
            <article key={row.id} className={ui.panel}>
              <div className={ui.between}>
                <span className={ui.tile}>
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
              <p>{'type' in row ? directions[row.type] : kinds[row.kind]}</p>
              {account && (
                <strong className={ui.figure}>
                  {money(account.balance_cents)}
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
