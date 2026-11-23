'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MovementEditor } from '@/features/ledger/Editor';
import { Heading } from '@/components/Heading';
import { useBook } from '@/local/store';
import { accountBalances, categoryList, movementView } from '@/local/views';
import { today } from '@/lib/dates';
import { useTitle, withSuspense } from '@/lib/page';
import ui from '@/components/ui.module.scss';

export default withSuspense(function Edit() {
  const book = useBook();
  const id = useSearchParams().get('id');
  const record = id ? book.get('transactions', id) : undefined;
  const item = record ? movementView(book, record) : null;
  useTitle(item ? 'Editar movimiento' : 'Agregar movimiento');
  if (id && !item)
    return (
      <p role="alert" className={ui.notice}>
        Ese movimiento ya no está disponible. <Link href="/movimientos">Volver al historial</Link>
      </p>
    );
  return (
    <>
      <Heading title={item ? 'Editar movimiento' : 'Agregar movimiento'} />
      <MovementEditor
        key={item?.id ?? 'nuevo'}
        accounts={accountBalances(book)}
        categories={categoryList(book)}
        initialDate={today()}
        item={item ?? undefined}
      />
    </>
  );
});
