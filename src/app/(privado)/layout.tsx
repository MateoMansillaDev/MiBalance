import { Shell } from '@/components/Shell';
import { requireUser } from '@/lib/supabase/server';
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <Shell>{children}</Shell>;
}
