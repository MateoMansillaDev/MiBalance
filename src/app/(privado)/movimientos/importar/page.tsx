'use client';
import Link from 'next/link';
import { Heading } from '@/components/Heading';
import { ImportForm } from '@/features/csv/ImportForm';
import { useTitle } from '@/lib/page';
export default function ImportPage() {
  useTitle('Importar CSV');
  return (
    <>
      <Heading title="Importar CSV">
        <Link href="/movimientos">Volver al historial</Link>
      </Heading>
      <ImportForm />
    </>
  );
}
