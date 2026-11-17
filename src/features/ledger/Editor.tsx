'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { save, remove, type Resource } from './actions';
import {
  directions,
  kinds,
  type Movement,
  type Account,
  type Category,
  type Direction,
} from '@/lib/domain';
import { decimal } from '@/lib/money';
import ui from '@/components/ui.module.scss';

function Form({
  resource,
  id,
  cancel,
  children,
}: {
  resource: Resource;
  id?: string;
  cancel: string;
  children: React.ReactNode;
}) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        start(async () => {
          const result = await save(resource, id ?? null, {}, fields);
          setError(result?.error ?? '');
        });
      }}
    >
      {children}
      {error && (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      )}
      <div className={ui.actions}>
        <button disabled={pending} className={ui.primary}>
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        <Link href={cancel}>Cancelar</Link>
      </div>
    </form>
  );
}
export function DeleteForm({
  resource,
  id,
}: {
  resource: Resource;
  id: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  if (!confirm)
    return (
      <button
        type="button"
        className={ui.danger}
        onClick={() => setConfirm(true)}
      >
        Eliminar
      </button>
    );
  return (
    <form
      className={ui.confirm}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await remove(resource, id, {}, form);
          setError(result?.error ?? '');
        });
      }}
    >
      <p>¿Querés eliminar este registro? Esta acción es permanente.</p>
      <input type="hidden" name="confirmed" value="yes" />
      <div className={ui.actions}>
        <button className={ui.danger} disabled={pending}>
          Confirmar eliminación
        </button>
        <button
          className={ui.secondary}
          type="button"
          onClick={() => {
            setConfirm(false);
            setError('');
          }}
        >
          Conservar
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
export function CatalogEditor({
  resource,
  item,
}: {
  resource: 'accounts' | 'categories';
  item?: Account | Category;
}) {
  const account = item && 'kind' in item ? item : undefined;
  const category = item && 'type' in item ? item : undefined;
  return (
    <section className={ui.panel}>
      <h2>
        {item ? 'Editar' : 'Nueva'}{' '}
        {resource === 'accounts' ? 'cuenta' : 'categoría'}
      </h2>
      <Form
        resource={resource}
        id={item?.id}
        cancel={resource === 'accounts' ? '/cuentas' : '/categorias'}
      >
        <label>
          Nombre
          <input
            name="name"
            defaultValue={item?.name}
            maxLength={80}
            required
          />
        </label>
        {resource === 'accounts' ? (
          <>
            <label>
              Tipo de cuenta
              <select name="kind" defaultValue={account?.kind}>
                {Object.entries(kinds).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Saldo inicial (ARS)
              <input
                inputMode="decimal"
                name="opening_balance_cents"
                required
                defaultValue={decimal(account?.opening_balance_cents ?? '0')}
              />
            </label>
          </>
        ) : (
          <label>
            Tipo
            <select name="type" defaultValue={category?.type}>
              {Object.entries(directions).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
      </Form>
      {item && <DeleteForm resource={resource} id={item.id} />}
    </section>
  );
}
export function MovementEditor({
  accounts,
  categories,
  initialDate,
  item,
}: {
  accounts: Account[];
  categories: Category[];
  initialDate: string;
  item?: Movement;
}) {
  const [type, setType] = useState<Direction>(item?.type ?? 'expense');
  const choices = categories.filter((c) => c.type === type);
  return (
    <section className={ui.editor}>
      <Form resource="transactions" id={item?.id} cancel="/movimientos">
        <fieldset className={ui.segment}>
          <legend>Tipo de movimiento</legend>
          {Object.entries(directions).map(([v, l]) => (
            <label key={v}>
              <input
                type="radio"
                name="type"
                value={v}
                checked={type === v}
                onChange={() => setType(v as Direction)}
              />
              {l}
            </label>
          ))}
        </fieldset>
        <label>
          Importe (ARS)
          <input
            className={ui.amount}
            inputMode="decimal"
            name="amount_cents"
            placeholder="0,00"
            required
            defaultValue={item ? decimal(item.amount_cents) : ''}
          />
        </label>
        <div className={ui.pair}>
          <label>
            Cuenta
            <select name="account_id" required defaultValue={item?.account_id}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoría
            <select
              key={type}
              name="category_id"
              required
              defaultValue={item?.type === type ? item.category_id : ''}
            >
              <option value="" disabled>
                Elegí una categoría
              </option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!accounts.length && (
          <Link href="/cuentas?nueva=1">Crear una cuenta</Link>
        )}
        {!choices.length && (
          <Link href="/categorias?nueva=1">
            Crear una categoría de {directions[type].toLowerCase()}
          </Link>
        )}
        <label>
          Fecha
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={item?.occurred_on ?? initialDate}
          />
        </label>
        <label>
          Descripción (opcional)
          <textarea
            name="description"
            maxLength={500}
            rows={2}
            defaultValue={item?.description}
          />
        </label>
      </Form>
      {item && <DeleteForm resource="transactions" id={item.id} />}
    </section>
  );
}
