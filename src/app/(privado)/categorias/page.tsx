'use client';
import { useSearchParams } from 'next/navigation';
import { Catalog } from '@/features/ledger/Catalog';
import { useTitle, withSuspense } from '@/lib/page';
export default withSuspense(function Page() {
  useTitle('Categorías');
  const params = useSearchParams();
  return (
    <Catalog
      finance={false}
      edit={params.get('editar') ?? undefined}
      create={params.get('nueva') === '1'}
    />
  );
});
