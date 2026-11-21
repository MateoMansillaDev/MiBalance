import Link from 'next/link';
import { Heading } from '@/components/Heading';
import { MutationForm } from '@/components/MutationForm';
import { removeItem, saveGoal } from '@/features/accounts/advanced-actions';
import { accounts, allRows } from '@/features/ledger/queries';
import { requireUser } from '@/lib/supabase/server';
import { money, decimal, percent } from '@/lib/money';
import ui from '@/components/ui.module.scss';
import s from '@/features/planning/planning.module.scss';
export const metadata = { title: 'Metas de ahorro' };

type Goal = {
  id: string;
  name: string;
  account_id: string;
  target_cents: string;
};
function GoalFields({ goal }: { goal?: Goal }) {
  return (
    <div className={ui.pair}>
      <label>
        Nombre de la meta
        <input name="name" required maxLength={80} defaultValue={goal?.name} />
      </label>
      <label>
        Objetivo (ARS)
        <input
          name="target_cents"
          inputMode="decimal"
          required
          defaultValue={goal && decimal(goal.target_cents)}
        />
      </label>
    </div>
  );
}
export default async function Goals() {
  const { db, user } = await requireUser();
  const [list, goals] = await Promise.all([
    accounts(),
    allRows<Goal>((offset) =>
      db
        .from('savings_goals')
        .select('id,name,account_id,target_cents::text')
        .eq('user_id', user.id)
        .order('id')
        .range(offset, offset + 199)
        .returns<Goal[]>(),
    ),
  ]);
  const byAccount = new Map(list.map((a) => [a.id, a]));
  const assigned = new Set(goals.map((g) => g.account_id));
  const available = list.filter((a) => !assigned.has(a.id));
  return (
    <>
      <Heading
        title="Metas de ahorro"
        description="Elegí una meta por cuenta. Su avance sigue el saldo disponible, incluidas las transferencias."
      >
        <Link href="/planificacion" className={ui.secondary}>
          Ver planificación
        </Link>
      </Heading>
      {!goals.length && (
        <p className={ui.empty}>Todavía no definiste metas de ahorro.</p>
      )}
      <div className={ui.catalog}>
        {goals.map((goal) => {
          const account = byAccount.get(goal.account_id);
          if (!account) return null;
          const balance = BigInt(account.balance_cents),
            target = BigInt(goal.target_cents);
          return (
            <article className={ui.panel} key={goal.id}>
              <h2>{goal.name}</h2>
              <p>
                {account.name} · Saldo {money(balance)}
              </p>
              <progress
                aria-label={'Avance de ' + goal.name}
                max={100}
                value={Math.max(0, Math.min(100, percent(balance, target)))}
              />
              <p>
                Objetivo {money(target)} ·{' '}
                {balance >= target
                  ? 'Meta alcanzada'
                  : 'Faltan ' + money(target - balance)}
              </p>
              <details className={s.disclosure}>
                <summary>Editar meta</summary>
                <MutationForm
                  action={saveGoal.bind(null, goal.id)}
                  submit="Guardar cambios"
                >
                  <input type="hidden" name="account_id" value={account.id} />
                  <GoalFields goal={goal} />
                </MutationForm>
                <MutationForm
                  action={removeItem.bind(null, 'savings_goals', goal.id)}
                  submit="Eliminar meta"
                  confirm="¿Eliminar esta meta de ahorro?"
                />
              </details>
            </article>
          );
        })}
      </div>
      <section className={ui.panel}>
        <h2>Nueva meta</h2>
        {available.length ? (
          <MutationForm
            action={saveGoal.bind(null, null)}
            submit="Crear meta"
            resetOnSuccess
          >
            <label>
              Cuenta para ahorrar
              <select name="account_id">
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <GoalFields />
          </MutationForm>
        ) : (
          <p>
            <Link href="/cuentas?nueva=1">Crear una cuenta para esta meta</Link>
          </p>
        )}
      </section>
    </>
  );
}
