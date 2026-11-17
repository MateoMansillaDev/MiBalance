import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import '@/styles/globals.scss';
export const metadata: Metadata = {
  title: { default: 'MiBalance', template: '%s · MiBalance' },
  description: 'Tus cuentas, ingresos y gastos personales en pesos argentinos.',
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = (await cookies()).get('mb-theme')?.value;
  return (
    <html
      lang="es-AR"
      data-theme={theme === 'dark' || theme === 'light' ? theme : undefined}
    >
      <body>{children}</body>
    </html>
  );
}
