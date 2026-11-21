import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ListFilter,
} from 'lucide-react';
import { dateLabel } from '@/lib/dates';
import { money } from '@/lib/money';
import { directions, type Movement } from '@/lib/domain';
import { categoryColor } from '@/lib/categoryIcons';
import ui from '@/components/ui.module.scss';
export function MovementList({
  rows,
  empty,
}: {
  rows: Movement[];
  empty: string;
}) {
  if (!rows.length)
    return (
      <div className={ui.empty}>
        <ListFilter size={23} />
        <p>{empty}</p>
      </div>
    );
  return (
    <ul className={ui.movements}>
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={'/movimientos/' + row.id}>
            <span className={row.type === 'income' ? ui.up : ui.down}>
              {row.type === 'income' ? (
                <ArrowDownLeft size={18} />
              ) : (
                <ArrowUpRight size={18} />
              )}
            </span>
            <span className={ui.details}>
              <strong>{row.description || row.category_name}</strong>
              <small>
                <i
                  className={ui.swatch}
                  style={{
                    background: categoryColor(
                      row.category_name,
                      row.category_color,
                    ),
                  }}
                  aria-hidden="true"
                />
                {row.account_name} · {row.category_name}
                {row.installment_count &&
                  ' · Cuota ' +
                    row.installment_number +
                    '/' +
                    row.installment_count}
              </small>
            </span>
            <span className={ui.value}>
              <strong>
                {row.type === 'expense' ? '−' : '+'}
                {money(row.amount_cents, row.currency)}
              </strong>
              <small>
                {directions[row.type]} · {dateLabel(row.occurred_on)}
              </small>
            </span>
            <ChevronRight size={15} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
