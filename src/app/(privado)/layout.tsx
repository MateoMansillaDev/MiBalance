import { cookies } from 'next/headers';
import { Shell } from '@/components/Shell';
import { PinLock } from '@/components/PinLock';
import { requireUser } from '@/lib/supabase/server';
import { PIN_COOKIE } from '@/lib/preferences';
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  // La cookie solo indica que hay un PIN: así la pantalla de bloqueo se dibuja
  // desde el servidor y los datos no aparecen ni un instante.
  const pin = (await cookies()).get(PIN_COOKIE)?.value === '1';
  return (
    <PinLock enabled={pin}>
      <Shell>{children}</Shell>
    </PinLock>
  );
}
