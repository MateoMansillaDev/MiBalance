export const zone = 'America/Argentina/Cordoba';
export function today(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function validDate(value: string) {
  if (!/^[1-9]\d{3}-\d\d-\d\d$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return (
    Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
export function period(month: string) {
  if (!validDate(month + '-01')) throw new Error('Mes inválido.');
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { start: month + '-01', end: month + '-' + last };
}
export function previousMonth(month: string) {
  const { start } = period(month);
  if (start === '1000-01-01') return null;
  const date = new Date(start + 'T12:00:00Z');
  date.setUTCDate(0);
  return date.toISOString().slice(0, 7);
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(month + '-01T12:00:00Z'));
}
export function dateLabel(date: string) {
  return date.split('-').reverse().join('/');
}
