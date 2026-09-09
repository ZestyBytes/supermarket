import type { ReactNode } from 'react';
import {
  ShoppingBagIcon, PlusIcon, MinusIcon, CheckIcon, ChevronRightIcon, ChevronDownIcon,
  ChevronUpIcon, ClockIcon, MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon,
  InformationCircleIcon, ExclamationTriangleIcon, ArrowUpRightIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const icons = {
  settings: Cog6ToothIcon, shop: ShoppingBagIcon, plus: PlusIcon, minus: MinusIcon,
  check: CheckIcon, arrow: ChevronRightIcon, down: ChevronDownIcon, up: ChevronUpIcon,
  clock: ClockIcon, search: MagnifyingGlassIcon, cross: XMarkIcon, retry: ArrowPathIcon,
  info: InformationCircleIcon, warning: ExclamationTriangleIcon, external: ArrowUpRightIcon,
};

/**
 * The two icons this app needs that a general icon set does not have.
 *
 * "Meals" was a grid of squares and "Shopping list" a stack of bars: one
 * described the screen's layout, the other could have meant a menu, a
 * playlist or a paragraph. Both are drawn here instead, on the same 24px grid
 * and at the same stroke weight as the rest, so they sit in the row without
 * looking like guests.
 */
export function Icon({
  name = 'plus',
  size = 22,
  className,
  stroke = 1.7,
}: { name?: string; size?: number; className?: string; stroke?: number }) {
  if (name === 'meals') return <Drawn size={size} stroke={stroke} className={className}><Meals /></Drawn>;
  if (name === 'list') return <Drawn size={size} stroke={stroke} className={className}><List /></Drawn>;
  const Glyph = icons[name as keyof typeof icons] ?? InformationCircleIcon;
  return <Glyph width={size} height={size} strokeWidth={stroke} className={className} aria-hidden="true" focusable="false" />;
}

function Drawn({
  size, stroke, className, children,
}: { size: number; stroke: number; className?: string; children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * A knife and fork, the way a place is set.
 *
 * The plate went. A circle between the cutlery either reads as a target or
 * gets clipped by it, and at 25px the two implements alone are what people
 * recognise: no icon set draws a plate, and every one of them draws these.
 */
function Meals() {
  return (
    <>
      {/* Fork: two outer tines closing into the handle, one down the middle. */}
      <path d="M6.2 3v4a2.4 2.4 0 0 0 4.8 0V3" />
      <path d="M8.6 3v18" />
      {/* Knife: a straight spine running into the handle, with the blade
          bellying out from it. An open curve on its own reads as a bracket. */}
      <path d="M16.2 3v18" />
      <path d="M16.2 3c2 1 3.1 3 3.1 5.2 0 1.7-1.1 2.8-3.1 3.1" />
    </>
  );
}

/** A list with two of its lines ticked, which is what a shopping list looks like. */
function List() {
  return (
    <>
      <path d="m3 6.4 1.6 1.6L7.5 5" />
      <path d="m3 13.4 1.6 1.6L7.5 12" />
      <path d="M10.8 6.6H21M10.8 13.6H21M10.8 20.6H21" />
      <circle cx="4.5" cy="20.6" r="1.1" />
    </>
  );
}
