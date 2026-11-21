import {
  BookOpen,
  Briefcase,
  Bus,
  Clapperboard,
  Gift,
  HeartPulse,
  House,
  PawPrint,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryIcon } from './domain';

export const iconSet: Record<CategoryIcon, { icon: LucideIcon; label: string }> = {
  tag: { icon: Tag, label: 'Etiqueta' },
  briefcase: { icon: Briefcase, label: 'Trabajo' },
  gift: { icon: Gift, label: 'Regalo' },
  cart: { icon: ShoppingCart, label: 'Compras' },
  bus: { icon: Bus, label: 'Transporte' },
  home: { icon: House, label: 'Hogar' },
  utensils: { icon: Utensils, label: 'Comida' },
  heart: { icon: HeartPulse, label: 'Salud' },
  bolt: { icon: Zap, label: 'Servicios' },
  film: { icon: Clapperboard, label: 'Entretenimiento' },
  shirt: { icon: Shirt, label: 'Ropa' },
  book: { icon: BookOpen, label: 'Educación' },
  plane: { icon: Plane, label: 'Viajes' },
  paw: { icon: PawPrint, label: 'Mascotas' },
  phone: { icon: Smartphone, label: 'Tecnología' },
  piggy: { icon: PiggyBank, label: 'Ahorro' },
};

const palette = ['#6d3fe0', '#0f7a55', '#c2410c', '#2563eb', '#b4237a', '#a16207', '#0e7490', '#7c3aed'];
/** Color estable para una categoría sin color propio. */
export function categoryColor(name: string, color: string | null | undefined) {
  if (color) return color;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
