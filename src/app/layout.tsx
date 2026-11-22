import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { RegisterWorker } from '@/components/RegisterWorker';
import '@/styles/globals.scss';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});
export const metadata: Metadata = {
  title: { default: 'MiBalance', template: '%s · MiBalance' },
  description: 'Tus cuentas, ingresos y gastos personales en pesos argentinos.',
  icons: {
    apple: '/icons/mibalance-192.png',
    icon: '/icons/mibalance-192.png',
  },
  appleWebApp: { capable: true, title: 'MiBalance' },
};
// Aplica el tema guardado antes de pintar, para que no parpadee.
const themeScript =
  "try{var t=localStorage.getItem('mb-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <RegisterWorker />
      </body>
    </html>
  );
}
