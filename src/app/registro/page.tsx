import { AuthScreen } from '@/features/auth/AuthScreen';
import { config } from '@/lib/supabase/config';
export const metadata = { title: 'Crear cuenta' };
export default function Register() {
  return <AuthScreen configured={!!config()} register />;
}
