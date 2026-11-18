import Link from 'next/link';
import { Heading } from '@/components/Heading';
import { ImportForm } from '@/features/csv/ImportForm';
import { requireUser } from '@/lib/supabase/server';
export const metadata = { title: 'Importar CSV' };
export default async function ImportPage() {
  await requireUser();
  return (
    <>
      <Heading title="Importar CSV">
        <Link href="/movimientos">Volver al historial</Link>
      </Heading>
      <ImportForm />
    </>
  );
}
