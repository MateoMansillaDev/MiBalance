import { Catalog } from '@/features/ledger/Catalog';
export const metadata = { title: 'Cuentas' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string; nueva?: string }>;
}) {
  const params = await searchParams;
  return (
    <Catalog
      finance={true}
      edit={params.editar}
      create={params.nueva === '1'}
    />
  );
}
