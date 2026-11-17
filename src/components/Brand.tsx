import { Layers2 } from 'lucide-react';
import s from './ui.module.scss';
export function Brand() {
  return (
    <span className={s.brand}>
      <i aria-hidden="true">
        <Layers2 size={21} />
      </i>
      MiBalance<span className={s.dot}>.</span>
    </span>
  );
}
