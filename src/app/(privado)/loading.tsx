import ui from '@/components/ui.module.scss';
export default function Loading() {
  return (
    <p className={ui.panel} role="status">
      Cargando tu información…
    </p>
  );
}
