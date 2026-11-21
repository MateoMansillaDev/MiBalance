'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import {
  accountInput,
  categoryInput,
  transactionInput,
  uuid,
} from '@/lib/domain';
export type Resource = 'accounts' | 'categories' | 'transactions';
export type Result = { error?: string };
const paths = {
  accounts: '/cuentas',
  categories: '/categorias',
  transactions: '/movimientos',
};
const schemas = {
  accounts: accountInput,
  categories: categoryInput,
  transactions: transactionInput,
};
function databaseError(code: string) {
  if (code === '23503')
    return 'Revisá la cuenta, la categoría y el tipo. Puede haber movimientos, presupuestos o repeticiones vinculados.';
  if (code === '23505') return 'Ya existe un registro con ese nombre.';
  return 'No pudimos guardar los cambios. Revisá la conexión y volvé a intentar.';
}
function refresh(resource: Resource): never {
  revalidatePath('/', 'layout');
  redirect(paths[resource]);
}
export async function save(
  resource: Resource,
  id: string | null,
  _: Result,
  form: FormData,
): Promise<Result> {
  const { db, user } = await requireUser();
  if (
    !Object.hasOwn(schemas, resource) ||
    (id !== null && !uuid.safeParse(id).success)
  )
    return { error: 'Registro inválido.' };
  const input = Object.fromEntries(form);
  const parsed = schemas[resource].safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if ('category_id' in parsed.data) {
    const tx = parsed.data;
    const [account, category] = await Promise.all([
      db
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', tx.account_id)
        .maybeSingle(),
      db
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', tx.category_id)
        .eq('type', tx.type)
        .maybeSingle(),
    ]);
    if (account.error || category.error)
      return { error: 'No se pudieron verificar la cuenta y la categoría.' };
    if (!account.data || !category.data)
      return {
        error: 'Elegí una cuenta propia y una categoría del mismo tipo.',
      };
  }
  const table = db.from(resource);
  const operation = id
    ? table.update(parsed.data).eq('user_id', user.id).eq('id', id)
    : table.insert({ ...parsed.data, user_id: user.id });
  const { error, data } = await operation.select('id').maybeSingle();
  if (error) return { error: databaseError(error.code) };
  if (!data) return { error: 'Ese registro ya no está disponible.' };
  refresh(resource);
}
export async function remove(
  resource: Resource,
  id: string,
  _: Result,
  form: FormData,
): Promise<Result> {
  const { db, user } = await requireUser();
  if (
    !Object.hasOwn(paths, resource) ||
    !uuid.safeParse(id).success ||
    form.get('confirmed') !== 'yes'
  )
    return { error: 'Confirmá la eliminación.' };
  const { error, data } = await db
    .from(resource)
    .delete()
    .eq('user_id', user.id)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error)
    return {
      error:
        error.code === '23503'
          ? 'Revisá los movimientos vinculados, presupuestos, repeticiones, transferencias y metas antes de eliminar este registro.'
          : databaseError(error.code),
    };
  if (!data) return { error: 'Ese registro ya no está disponible.' };
  refresh(resource);
}
