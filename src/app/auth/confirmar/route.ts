import type { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';
import { database } from '@/lib/supabase/server';
import { config } from '@/lib/supabase/config';
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get('token_hash');
  if (hash && config()) {
    const db = await database();
    const { error } = await db.auth.verifyOtp({
      type: 'email',
      token_hash: hash,
    });
    if (!error) redirect('/resumen');
  }
  redirect('/ingresar?confirmacion=invalida');
}
