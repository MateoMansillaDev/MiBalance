'use client';
import { useState } from 'react';
import { MutationForm } from '@/components/MutationForm';
import { addRule } from './actions';
import type { Account, Category, Direction } from '@/lib/domain';
import ui from '@/components/ui.module.scss';

export function RuleForm({
  accounts,
  categories,
  date,
}: {
  accounts: Pick<Account, 'id' | 'name'>[];
  categories: Category[];
  date: string;
}) {
  const [type, setType] = useState<Direction>('expense');
  const [requestId, setRequestId] = useState('');
  async function submit(form: FormData) {
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    form.set('id', id);
    const result = await addRule(form);
    if ('message' in result) {
      setRequestId('');
      setType('expense');
    }
    return result;
  }
  return (
    <MutationForm action={submit} submit="Programar movimiento" resetOnSuccess>
      <div className={ui.pair}>
        <label>
          Tipo
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as Direction)}
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
        <label>
          Importe (ARS)
          <input name="amount_cents" inputMode="decimal" required />
        </label>
      </div>
      <div className={ui.pair}>
        <label>
          Cuenta
          <select name="account_id" required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <select key={type} name="category_id" required>
            {categories
              .filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className={ui.pair}>
        <label>
          Primera fecha
          <input
            type="date"
            name="occurred_on"
            required
            min="1900-01-01"
            defaultValue={date}
          />
        </label>
        <label>
          Frecuencia
          <select name="frequency">
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>
        </label>
      </div>
      <label>
        Descripción (opcional)
        <input name="description" maxLength={500} />
      </label>
      <p>
        Si elegís una fecha pasada, se registrarán también los vencimientos
        hasta hoy.
      </p>
    </MutationForm>
  );
}
