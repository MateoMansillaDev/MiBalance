import { notFound } from 'next/navigation';
import { accounts, categories, movement } from '@/features/ledger/queries';
import { MovementEditor } from '@/features/ledger/Editor';
import { Heading } from '@/components/Heading';
import { today } from '@/lib/dates';
import { uuid } from '@/lib/domain';
export const metadata = { title: 'Movimiento' };
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id !== 'nuevo' && !uuid.safeParse(id).success) notFound();
  const [list, tags, item] = await Promise.all([
    accounts(),
    categories(),
    id === 'nuevo' ? null : movement(id),
  ]);
  if (id !== 'nuevo' && !item) notFound();
  return (
    <>
      <Heading title={item ? 'Editar movimiento' : 'Agregar movimiento'} />
      <MovementEditor
        accounts={list}
        categories={tags}
        initialDate={today()}
        item={item ?? undefined}
      />
    </>
  );
}
