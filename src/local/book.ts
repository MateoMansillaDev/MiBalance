import { addDays, addMonths, validDate } from '@/lib/dates';
import { splitInstallments } from '@/lib/money';
import type { Currency, Direction, Kind, CategoryIcon } from '@/lib/domain';
import { latestStamp } from './merge';
import { collections, type Collection, type Doc, type Rec } from './schema';
import { newId, stableId } from './ids';

/** Error con un mensaje apto para mostrar a la persona. */
export class DomainError extends Error {}
const fail = (message: string): never => {
  throw new DomainError(message);
};

const key = (name: string) => name.trim().toLowerCase();
function checkName(name: string) {
  const value = name.trim();
  if (value.length < 1 || value.length > 80) fail('Usá un nombre de 1 a 80 caracteres.');
  return value;
}
function checkCents(value: string, label = 'El importe') {
  if (!/^\d{1,19}$/.test(value) || BigInt(value) <= 0n || BigInt(value) > 9223372036854775807n)
    fail(label + ' debe ser mayor que cero.');
  return value;
}
function checkDate(value: string) {
  if (!validDate(value)) fail('Ingresá una fecha válida.');
  return value;
}
function checkText(value: string) {
  const text = value.trim();
  if (text.length > 500) fail('Usá hasta 500 caracteres.');
  return text;
}

export const SEED_CATEGORIES: [string, Direction][] = [
  ['Sueldo', 'income'],
  ['Otros ingresos', 'income'],
  ['Alimentación', 'expense'],
  ['Transporte', 'expense'],
  ['Hogar', 'expense'],
  ['Otros gastos', 'expense'],
];

export type AccountInput = {
  name: string;
  kind: Kind;
  currency: Currency;
  opening_balance_cents: string;
};
export type CategoryInput = {
  name: string;
  type: Direction;
  color: string | null;
  icon: CategoryIcon | null;
};
export type MovementInput = {
  type: Direction;
  account_id: string;
  category_id: string;
  amount_cents: string;
  occurred_on: string;
  description: string;
};
export type TransferInput = {
  source_id: string;
  destination_id: string;
  amount_cents: string;
  occurred_on: string;
  description: string;
};
export type ExchangeInput = {
  source_id: string;
  destination_id: string;
  source_cents: string;
  destination_cents: string;
  occurred_on: string;
  description: string;
};
export type RuleInput = MovementInput & { frequency: 'weekly' | 'monthly' };
export type CsvItem = MovementInput & { reference: string | null };

/**
 * El libro: las operaciones aplican las mismas reglas que imponía el esquema
 * de PostgreSQL (importes positivos, cuentas y categorías existentes, tipos
 * compatibles, monedas, borrados bloqueados por historial) sobre un documento
 * local. Cada operación valida todo antes de escribir: o se aplica entera o no
 * cambia nada.
 */
export class Book {
  doc: Doc;
  private device: string;
  private clock: () => number;
  private last: number;
  constructor(doc: Doc, device: string, clock: () => number = Date.now) {
    this.doc = doc;
    this.device = device;
    this.clock = clock;
    this.last = latestStamp(doc);
  }

  // ---------- lectura básica ----------
  live<C extends Collection>(c: C): Rec<C>[] {
    return (Object.values(this.doc.collections[c]) as Rec<C>[]).filter((r) => !r.deleted);
  }
  get<C extends Collection>(c: C, id: string): Rec<C> | undefined {
    const rec = (this.doc.collections[c] as Record<string, Rec<C>>)[id];
    return rec && !rec.deleted ? rec : undefined;
  }
  private need<C extends Collection>(c: C, id: string, message: string) {
    return this.get(c, id) ?? fail(message);
  }

  // ---------- escritura ----------
  private tick() {
    this.last = Math.max(this.clock(), this.last + 1);
    return this.last;
  }
  private put<C extends Collection>(c: C, rec: Omit<Rec<C>, 'updated_at' | 'device'>) {
    const full = { ...rec, updated_at: this.tick(), device: this.device } as Rec<C>;
    (this.doc.collections[c] as Record<string, Rec<C>>)[full.id] = full;
    return full;
  }
  private drop<C extends Collection>(c: C, id: string) {
    const rec = this.get(c, id);
    if (!rec) return false;
    this.put(c, { ...rec, deleted: true });
    return true;
  }

  // ---------- inicio ----------
  /** Crea Efectivo y las categorías sugeridas una sola vez por persona. */
  initialize() {
    if (this.get('settings', 'onboarding')) return;
    const cash = stableId('seed:account:cash');
    if (!this.doc.collections.accounts[cash])
      this.put('accounts', {
        id: cash,
        name: 'Efectivo',
        kind: 'cash',
        currency: 'ARS',
        opening_balance_cents: '0',
      });
    for (const [name, type] of SEED_CATEGORIES) {
      const id = stableId('seed:category:' + type + ':' + name);
      if (!this.doc.collections.categories[id])
        this.put('categories', { id, name, type, color: null, icon: null });
    }
    this.put('settings', { id: 'onboarding', value: '1' });
  }

  // ---------- cuentas ----------
  private accountInUse(id: string) {
    return (
      this.live('transactions').some((t) => t.account_id === id) ||
      this.live('transfers').some((t) => t.source_id === id || t.destination_id === id) ||
      this.live('exchanges').some((e) => e.source_id === id || e.destination_id === id) ||
      this.live('rules').some((r) => r.account_id === id) ||
      this.live('goals').some((g) => g.account_id === id)
    );
  }
  saveAccount(id: string | null, input: AccountInput) {
    const name = checkName(input.name);
    if (!['cash', 'bank', 'wallet', 'credit'].includes(input.kind)) fail('Elegí un tipo de cuenta.');
    if (!['ARS', 'USD'].includes(input.currency)) fail('Elegí una moneda.');
    if (!/^-?\d{1,19}$/.test(input.opening_balance_cents)) fail('Ingresá un saldo inicial válido.');
    if (this.live('accounts').some((a) => a.id !== id && key(a.name) === key(name)))
      fail('Ya existe un registro con ese nombre.');
    const prior = id ? this.need('accounts', id, 'Ese registro ya no está disponible.') : null;
    if (prior && prior.currency !== input.currency && this.accountInUse(prior.id))
      fail('La cuenta tiene historial y no puede cambiar de moneda.');
    return this.put('accounts', { ...input, name, id: prior?.id ?? newId() });
  }
  removeAccount(id: string) {
    this.need('accounts', id, 'Ese registro ya no está disponible.');
    if (this.accountInUse(id))
      fail('Revisá los movimientos vinculados, presupuestos, repeticiones, transferencias y metas antes de eliminar este registro.');
    this.drop('accounts', id);
  }

  // ---------- categorías ----------
  private categoryInUse(id: string) {
    return (
      this.live('transactions').some((t) => t.category_id === id) ||
      this.live('budgets').some((b) => b.category_id === id) ||
      this.live('rules').some((r) => r.category_id === id)
    );
  }
  saveCategory(id: string | null, input: CategoryInput) {
    const name = checkName(input.name);
    if (!['income', 'expense'].includes(input.type)) fail('Elegí un tipo.');
    if (input.color !== null && !/^#[0-9a-f]{6}$/.test(input.color)) fail('Elegí un color válido.');
    if (this.live('categories').some((c) => c.id !== id && c.type === input.type && key(c.name) === key(name)))
      fail('Ya existe un registro con ese nombre.');
    const prior = id ? this.need('categories', id, 'Ese registro ya no está disponible.') : null;
    if (prior && prior.type !== input.type && this.categoryInUse(prior.id))
      fail('Revisá la cuenta, la categoría y el tipo. Puede haber movimientos, presupuestos o repeticiones vinculados.');
    return this.put('categories', { ...input, name, id: prior?.id ?? newId() });
  }
  removeCategory(id: string) {
    this.need('categories', id, 'Ese registro ya no está disponible.');
    if (this.categoryInUse(id))
      fail('Revisá los movimientos vinculados, presupuestos, repeticiones, transferencias y metas antes de eliminar este registro.');
    this.drop('categories', id);
  }

  // ---------- movimientos ----------
  private checkMovement(input: MovementInput) {
    const account = this.need('accounts', input.account_id, 'Elegí una cuenta propia y una categoría del mismo tipo.');
    const category = this.need('categories', input.category_id, 'Elegí una cuenta propia y una categoría del mismo tipo.');
    if (category.type !== input.type) fail('Elegí una cuenta propia y una categoría del mismo tipo.');
    return {
      account,
      clean: {
        type: input.type,
        account_id: account.id,
        category_id: category.id,
        amount_cents: checkCents(input.amount_cents),
        occurred_on: checkDate(input.occurred_on),
        description: checkText(input.description),
      },
    };
  }
  saveMovement(id: string | null, input: MovementInput) {
    const { clean } = this.checkMovement(input);
    const prior = id ? this.need('transactions', id, 'Ese registro ya no está disponible.') : null;
    return this.put('transactions', {
      csv_key: null,
      installment_group: null,
      installment_number: null,
      installment_count: null,
      ...prior,
      ...clean,
      id: prior?.id ?? newId(),
    });
  }
  /** Compra en cuotas: todas o ninguna; un reintento con el mismo grupo no duplica. */
  addInstallments(input: MovementInput, count: number, group: string) {
    const { account, clean } = this.checkMovement(input);
    if (account.kind !== 'credit' || clean.type !== 'expense')
      fail('Las cuotas son para gastos con tarjeta de crédito.');
    if (this.live('transactions').some((t) => t.installment_group === group)) return;
    const parts = (() => {
      try {
        return splitInstallments(BigInt(clean.amount_cents), count);
      } catch (error) {
        return fail((error as Error).message);
      }
    })();
    parts.forEach((cents, i) =>
      this.put('transactions', {
        ...clean,
        id: stableId('installment:' + group + ':' + (i + 1)),
        amount_cents: cents.toString(),
        occurred_on: addMonths(clean.occurred_on, i),
        csv_key: null,
        installment_group: group,
        installment_number: i + 1,
        installment_count: count,
      }),
    );
  }
  removeMovement(id: string) {
    if (!this.drop('transactions', id)) fail('Ese registro ya no está disponible.');
  }
  removeInstallments(group: string) {
    const rows = this.live('transactions').filter((t) => t.installment_group === group);
    if (!rows.length) fail('No se pudieron eliminar las cuotas.');
    for (const r of rows) this.drop('transactions', r.id);
  }

  // ---------- transferencias y cambios ----------
  private pair(source: string, destination: string) {
    if (source === destination) fail('Elegí dos cuentas diferentes.');
    const a = this.need('accounts', source, 'Revisá las cuentas de origen y destino.');
    const b = this.need('accounts', destination, 'Revisá las cuentas de origen y destino.');
    return [a, b] as const;
  }
  saveTransfer(id: string, input: TransferInput, editing = false) {
    const [a, b] = this.pair(input.source_id, input.destination_id);
    if (a.currency !== b.currency)
      fail('Las dos cuentas deben tener la misma moneda. Para pasar de pesos a dólares usá Compra y venta de dólares.');
    const prior = this.get('transfers', id);
    if (editing && !prior) fail('No se pudo guardar la transferencia.');
    const clean = {
      source_id: a.id,
      destination_id: b.id,
      amount_cents: checkCents(input.amount_cents),
      occurred_on: checkDate(input.occurred_on),
      description: checkText(input.description),
    };
    // Reintento de un alta ya registrada con el mismo id: no se duplica.
    if (!editing && prior) return prior;
    return this.put('transfers', { ...clean, id });
  }
  removeTransfer(id: string) {
    if (!this.drop('transfers', id)) fail('No se pudo eliminar el registro.');
  }
  saveExchange(input: ExchangeInput) {
    const [a, b] = this.pair(input.source_id, input.destination_id);
    if (a.currency === b.currency)
      fail('Elegí una cuenta en pesos y otra en dólares. Para la misma moneda usá Transferencias.');
    return this.put('exchanges', {
      id: newId(),
      source_id: a.id,
      destination_id: b.id,
      source_cents: checkCents(input.source_cents, 'El importe que sale'),
      destination_cents: checkCents(input.destination_cents, 'El importe que entra'),
      occurred_on: checkDate(input.occurred_on),
      description: checkText(input.description),
    });
  }
  removeExchange(id: string) {
    if (!this.drop('exchanges', id)) fail('No se pudo eliminar el registro.');
  }

  // ---------- presupuestos ----------
  saveBudget(month: string, category_id: string, limit_cents: string) {
    const month_start = checkDate(month + '-01');
    const category = this.need('categories', category_id, 'Elegí una categoría de gasto.');
    if (category.type !== 'expense') fail('Elegí una categoría de gasto.');
    const prior = this.live('budgets').find(
      (b) => b.month_start === month_start && b.category_id === category.id,
    );
    return this.put('budgets', {
      id: prior?.id ?? newId(),
      month_start,
      category_id: category.id,
      limit_cents: checkCents(limit_cents, 'El límite'),
    });
  }
  removeBudget(id: string) {
    if (!this.drop('budgets', id)) fail('No se pudo eliminar el registro.');
  }

  // ---------- repeticiones ----------
  saveRule(input: RuleInput, id: string = newId()) {
    const { clean } = this.checkMovement(input);
    if (!['weekly', 'monthly'].includes(input.frequency)) fail('Elegí una frecuencia.');
    if (clean.occurred_on < '1900-01-01') fail('La primera fecha debe ser posterior a 1899.');
    // Reintento del mismo alta: no se duplica.
    const prior = this.get('rules', id);
    if (prior) return prior;
    return this.put('rules', {
      ...clean,
      id,
      frequency: input.frequency,
      starts_on: clean.occurred_on,
      next_due: clean.occurred_on,
    });
  }
  removeRule(id: string) {
    if (!this.drop('rules', id)) fail('No se pudo eliminar el registro.');
  }
  /**
   * Registra los vencimientos hasta hoy (misma regla que refresh_space). El id
   * de cada alta depende de la regla y la fecha, así que dos dispositivos que
   * lo hacen sin conexión no duplican el movimiento.
   */
  refresh(today: string) {
    this.initialize();
    for (const rule of this.live('rules')) {
      if (rule.next_due > today) continue;
      if (!this.get('accounts', rule.account_id) || !this.get('categories', rule.category_id)) continue;
      const day = Number(rule.starts_on.slice(8));
      let due = rule.next_due;
      while (due <= today) {
        const id = stableId('rule:' + rule.id + ':' + due);
        if (!this.doc.collections.transactions[id])
          this.put('transactions', {
            id,
            account_id: rule.account_id,
            category_id: rule.category_id,
            type: rule.type,
            amount_cents: rule.amount_cents,
            occurred_on: due,
            description: rule.description,
            csv_key: null,
            installment_group: null,
            installment_number: null,
            installment_count: null,
          });
        due = rule.frequency === 'weekly' ? addDays(due, 7) : addMonths(due, 1, day);
      }
      this.put('rules', { ...rule, next_due: due });
    }
  }

  // ---------- metas, filtros y ajustes ----------
  saveGoal(id: string | null, account_id: string, name: string, target_cents: string) {
    const account = this.need('accounts', account_id, 'Elegí una cuenta propia disponible.');
    if (this.live('goals').some((g) => g.id !== id && g.account_id === account.id))
      fail('Esta cuenta ya tiene una meta.');
    const prior = id ? this.need('goals', id, 'No se pudo guardar la meta.') : null;
    return this.put('goals', {
      id: prior?.id ?? newId(),
      account_id: account.id,
      name: checkName(name),
      target_cents: checkCents(target_cents, 'El objetivo'),
    });
  }
  removeGoal(id: string) {
    if (!this.drop('goals', id)) fail('No se pudo eliminar el registro.');
  }
  saveFilter(name: string, query: string) {
    const clean = checkName(name);
    if (query.length > 1800) fail('El filtro es demasiado largo.');
    const prior = this.live('filters').find((f) => key(f.name) === key(clean));
    return this.put('filters', { id: prior?.id ?? newId(), name: clean, query });
  }
  removeFilter(id: string) {
    if (!this.drop('filters', id)) fail('No se pudo eliminar el registro.');
  }
  setRate(ars_cents_per_usd: string, updated_on: string) {
    checkCents(ars_cents_per_usd, 'La cotización');
    checkDate(updated_on);
    this.put('settings', {
      id: 'exchange_rate',
      value: JSON.stringify({ ars_cents_per_usd, updated_on }),
    });
  }
  rate(): { ars_cents_per_usd: string; updated_on: string } | null {
    const rec = this.get('settings', 'exchange_rate');
    return rec ? JSON.parse(rec.value) : null;
  }

  // ---------- CSV ----------
  private contentKey(item: MovementInput) {
    return stableId(
      JSON.stringify([
        item.account_id,
        item.category_id,
        item.type,
        item.amount_cents,
        item.occurred_on,
        item.description,
      ]),
    );
  }
  /** Igual que csv_batch: valida el lote entero y devuelve qué filas se omiten por duplicadas. */
  csvBatch(items: CsvItem[], apply: boolean) {
    if (items.length < 1 || items.length > 300) fail('Lote inválido');
    const existing = this.live('transactions');
    const keys = new Set(existing.map((t) => t.csv_key).filter(Boolean));
    const ids = new Set(existing.map((t) => t.id));
    const contents = new Set(existing.map((t) => this.contentKey(t)));
    const rows = items.map((item) => {
      const { account, clean } = this.checkMovement(item);
      if (account.currency !== 'ARS') fail('Fila inválida');
      return { item, clean };
    });
    const skipped: boolean[] = [];
    const seenKeys = new Set<string>();
    const seenContent = new Set<string>();
    for (const { item, clean } of rows) {
      const content = this.contentKey(clean);
      const importKey = item.reference ? 'id:' + item.reference : content;
      let duplicate =
        seenKeys.has(importKey) ||
        keys.has(importKey) ||
        (item.reference !== null && ids.has(item.reference));
      if (!item.reference && !duplicate)
        duplicate = seenContent.has(content) || contents.has(content);
      if (apply && !duplicate)
        this.put('transactions', {
          ...clean,
          id: newId(),
          csv_key: importKey,
          installment_group: null,
          installment_number: null,
          installment_count: null,
        });
      seenKeys.add(importKey);
      seenContent.add(content);
      skipped.push(duplicate);
    }
    return skipped;
  }
}

export { collections };
