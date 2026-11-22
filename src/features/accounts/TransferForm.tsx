'use client';
import { useRef } from 'react';
import { MutationForm } from '@/components/MutationForm';
import { saveTransfer } from '@/local/actions';
import { decimal } from '@/lib/money';
import ui from '@/components/ui.module.scss';

export type TransferValues = {
  id: string;
  source_id: string;
  destination_id: string;
  amount_cents: string;
  occurred_on: string;
  description: string;
};
export function TransferForm({
  accounts,
  date,
  editing,
}: {
  accounts: { id: string; name: string; currency: string }[];
  date: string;
  editing?: TransferValues;
}) {
  const requestId = useRef('');
  async function submit(form: FormData) {
    if (editing) {
      form.set('id', editing.id);
      return saveTransfer(editing.id, form);
    }
    requestId.current ||= crypto.randomUUID();
    form.set('id', requestId.current);
    const result = saveTransfer(null, form);
    if ('message' in result) requestId.current = '';
    return result;
  }
  const options = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
      {a.currency === 'USD' ? ' (USD)' : ''}
    </option>
  ));
  return (
    <MutationForm
      action={submit}
      submit={editing ? 'Guardar cambios' : 'Registrar transferencia'}
      resetOnSuccess={!editing}
    >
      <div className={ui.pair}>
        <label>
          Cuenta de origen
          <select
            name="source_id"
            defaultValue={editing?.source_id ?? accounts[0].id}
          >
            {options}
          </select>
        </label>
        <label>
          Cuenta de destino
          <select
            name="destination_id"
            defaultValue={editing?.destination_id ?? accounts[1].id}
          >
            {options}
          </select>
        </label>
      </div>
      <div className={ui.pair}>
        <label>
          Importe
          <input
            name="amount_cents"
            inputMode="decimal"
            required
            defaultValue={editing ? decimal(editing.amount_cents) : ''}
          />
        </label>
        <label>
          Fecha
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={editing?.occurred_on ?? date}
          />
        </label>
      </div>
      <label>
        Descripción (opcional)
        <input
          name="description"
          maxLength={500}
          defaultValue={editing?.description}
        />
      </label>
    </MutationForm>
  );
}
