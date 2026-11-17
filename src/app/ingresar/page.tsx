import { AuthScreen } from '@/features/auth/AuthScreen';
import { config } from '@/lib/supabase/config';
export const metadata = { title: 'Iniciar sesión' };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ confirmacion?: string }>;
}) {
  return (
    <AuthScreen
      configured={!!config()}
      invalid={(await searchParams).confirmacion === 'invalida'}
    />
  );
}
