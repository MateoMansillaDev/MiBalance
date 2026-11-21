import type { Metadata } from 'next';
import { RegisterWorker } from '@/components/RegisterWorker';
import { cookies } from 'next/headers';
import '@/styles/globals.scss';
export const metadata: Metadata = {
  title: { default: 'MiBalance', template: '%s · MiBalance' },
  description: 'Tus cuentas, ingresos y gastos personales en pesos argentinos.',
  icons: {
    apple: '/icons/mibalance-192.png',
    icon: '/icons/mibalance-192.png',
  },
  appleWebApp: { capable: true, title: 'MiBalance' },
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
      <body>
        {children}
        <RegisterWorker />
      </body>
    </html>
  );
}
