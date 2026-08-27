import {
  BedDouble,
  Beer,
  Bike,
  Bus,
  Camera,
  Car,
  Castle,
  Church,
  Coffee,
  Footprints,
  Heart,
  IceCreamCone,
  Landmark,
  Mountain,
  Music,
  Palette,
  Pizza,
  Plane,
  Ship,
  ShoppingBag,
  Sparkles,
  Sun,
  Tent,
  Theater,
  Ticket,
  TrainFront,
  Trees,
  Utensils,
  Waves,
  Wine,
} from 'lucide-react';

import type { TagIconKey } from '@/lib/tag-icons';

/**
 * The subset of lucide's props the chips actually pass, so a hand-drawn icon
 * can sit in the registry alongside the real ones.
 */
type TagIconComponent = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}>;

/**
 * Football — lucide has no soccer ball, so this is drawn to its conventions:
 * 24×24 box, `currentColor`, uniform stroke, round caps and joins.
 *
 * Stroked panels rather than filled ones. Small filled shapes silt up at chip
 * size, which is why every lucide glyph is outline-only — held against `Beer`
 * at 11px, an outlined ball survives the same way its handle and rim do.
 */
function Football({
  size = 24,
  strokeWidth = 2,
  style,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      {/* Centre panel, and a seam from each of its corners out to the rim. */}
      <path d="M12 7 16.76 10.45 14.94 16.05 9.06 16.05 7.24 10.45Z" />
      <path d="M12 7 12 2.6" />
      <path d="m16.76 10.45 4.18-1.35" />
      <path d="m14.94 16.05 2.59 3.55" />
      <path d="M9.06 16.05 6.47 19.6" />
      <path d="M7.24 10.45 3.06 9.1" />
    </svg>
  );
}

/**
 * Key → icon component. Kept apart from `@/lib/tag-icons` so the pure data
 * module (keys, keyword map, resolution) stays importable from server code.
 */
export const TAG_ICON_COMPONENTS: Record<TagIconKey, TagIconComponent> = {
  'utensils': Utensils,
  'coffee': Coffee,
  'wine': Wine,
  'beer': Beer,
  'pizza': Pizza,
  'ice-cream-cone': IceCreamCone,
  'landmark': Landmark,
  'church': Church,
  'castle': Castle,
  'camera': Camera,
  'palette': Palette,
  'theater': Theater,
  'music': Music,
  'football': Football,
  'mountain': Mountain,
  'trees': Trees,
  'waves': Waves,
  'sun': Sun,
  'tent': Tent,
  'footprints': Footprints,
  'plane': Plane,
  'train-front': TrainFront,
  'bus': Bus,
  'car': Car,
  'ship': Ship,
  'bike': Bike,
  'bed-double': BedDouble,
  'shopping-bag': ShoppingBag,
  'ticket': Ticket,
  'heart': Heart,
  'sparkles': Sparkles,
};

/** Human label for tooltips and screen readers. */
export const TAG_ICON_LABELS: Record<TagIconKey, string> = {
  'utensils': 'Food',
  'coffee': 'Coffee',
  'wine': 'Wine',
  'beer': 'Drinks',
  'pizza': 'Pizza',
  'ice-cream-cone': 'Dessert',
  'landmark': 'Landmark',
  'church': 'Church',
  'castle': 'Castle',
  'camera': 'Viewpoint',
  'palette': 'Art',
  'theater': 'Show',
  'music': 'Music',
  'football': 'Football',
  'mountain': 'Hiking',
  'trees': 'Park',
  'waves': 'Water',
  'sun': 'Downtime',
  'tent': 'Camping',
  'footprints': 'Walking',
  'plane': 'Flight',
  'train-front': 'Train',
  'bus': 'Bus',
  'car': 'Car',
  'ship': 'Boat',
  'bike': 'Cycling',
  'bed-double': 'Stay',
  'shopping-bag': 'Shopping',
  'ticket': 'Booked',
  'heart': 'Must-see',
  'sparkles': 'Maybe',
};

/** Renders one tag icon at the given size and colour. */
export function TagIcon({
  icon,
  size = 12,
  color,
  className,
}: {
  icon: TagIconKey;
  size?: number;
  color?: string;
  className?: string;
}) {
  const Icon = TAG_ICON_COMPONENTS[icon];
  return (
    <Icon size={size} strokeWidth={2.5} style={{ color }} className={className} />
  );
}
