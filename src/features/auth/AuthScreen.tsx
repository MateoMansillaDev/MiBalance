'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Wallet,
  LockKeyhole,
  CircleDollarSign,
  Landmark,
} from 'lucide-react';
import { authenticate, type Feedback } from './actions';
import { Brand } from '@/components/Brand';
import s from './auth.module.scss';
import ui from '@/components/ui.module.scss';

export function AuthScreen({
  register = false,
  invalid = false,
  configured,
}: {
  register?: boolean;
  invalid?: boolean;
  configured: boolean;
}) {
  const [state, submit, pending] = useActionState(
    authenticate.bind(null, register),
    {} as Feedback,
  );
  const [visible, setVisible] = useState(false);
  return (
    <main className={s.page}>
      <section className={s.cover} aria-label="MiBalance">
        <Brand />
        <div className={s.illustration} aria-hidden="true">
          <div className={s.orbit} />
          <div className={s.orbitInner} />
          <div className={s.backcard} />
          <div className={s.walletcard}>
            <Wallet size={34} />
            <span>MiBalance.</span>
            <div className={s.cardline} />
            <div className={s.cardline} />
          </div>
          <i className={s.coin}>
            <CircleDollarSign />
          </i>
          <i className={s.bank}>
            <Landmark />
          </i>
        </div>
        <div className={s.coverText}>
          <h2>
            Tu dinero,
            <br />
            en perspectiva.
          </h2>
          <p>
            Reuní tus cuentas, registrá tus movimientos y seguí tu balance mes a
            mes.
          </p>
        </div>
      </section>
      <section className={s.entry}>
        <div className={s.mobileBrand}>
          <Brand />
        </div>
        <div className={s.formBox}>
          <span className={s.icon}>
            <LockKeyhole size={23} />
          </span>
          <h1>{register ? 'Creá tu cuenta' : 'Iniciá sesión'}</h1>
          <p>
            {register
              ? 'Abrí tu espacio personal con tu correo electrónico.'
              : 'Ingresá para consultar y registrar tus movimientos.'}
          </p>
          {!configured && (
            <p className={ui.notice}>
              Para habilitar el acceso, configurá Supabase en .env.local según
              el README.
            </p>
          )}
          {invalid && (
            <p role="alert" className={ui.notice}>
              El enlace de confirmación venció o ya fue utilizado. Intentá
              iniciar sesión.
            </p>
          )}
          <form action={submit} className={ui.form}>
            <label>
              Correo electrónico
              <input
                autoComplete="email"
                name="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                required
              />
            </label>
            <div>
              <label htmlFor="password">Contraseña</label>
              <span className={s.password}>
                <input
                  id="password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register ? 8 : 1}
                  placeholder={
                    register ? 'Al menos 8 caracteres' : 'Ingresá tu contraseña'
                  }
                />
                <button
                  type="button"
                  aria-label={
                    visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </div>
            {state.error && (
              <div role="alert" className={ui.notice}>
                {state.error}
              </div>
            )}
            {state.message && <p role="status">{state.message}</p>}
            <button className={ui.primary} disabled={pending}>
              {pending ? 'Un momento…' : register ? 'Crear cuenta' : 'Ingresar'}{' '}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className={s.switch}>
            {register ? '¿Ya tenés cuenta?' : '¿Primera vez en MiBalance?'}{' '}
            <Link href={register ? '/ingresar' : '/registro'}>
              {register ? 'Iniciá sesión' : 'Creá tu cuenta'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
