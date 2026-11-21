'use client';
import { useRef } from 'react';
import { MutationForm } from '@/components/MutationForm';
import { saveTransfer } from './advanced-actions';
import ui from '@/components/ui.module.scss';

export function TransferForm({
  accounts,
  date,
}: {
  accounts: { id: string; name: string }[];
  date: string;
}) {
  const requestId = useRef('');
  async function submit(form: FormData) {
    requestId.current ||= crypto.randomUUID();
    form.set('id', requestId.current);
    const result = await saveTransfer(form);
    if ('message' in result) requestId.current = '';
    return result;
  }
  const options = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ));
  return (
    <MutationForm
      action={submit}
      submit="Registrar transferencia"
      resetOnSuccess
    >
      <div className={ui.pair}>
        <label>
          Cuenta de origen
          <select name="source_id" defaultValue={accounts[0].id}>
            {options}
          </select>
        </label>
        <label>
          Cuenta de destino
          <select name="destination_id" defaultValue={accounts[1].id}>
            {options}
          </select>
        </label>
      </div>
      <div className={ui.pair}>
        <label>
          Importe (ARS)
          <input name="amount_cents" inputMode="decimal" required />
        </label>
        <label>
          Fecha
          <input type="date" name="occurred_on" required defaultValue={date} />
        </label>
      </div>
      <label>
        Descripción (opcional)
        <input name="description" maxLength={500} />
      </label>
    </MutationForm>
  );
}
