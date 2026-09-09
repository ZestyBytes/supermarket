import {QueueListIcon, AdjustmentsHorizontalIcon, ShoppingBagIcon, PlusIcon, MinusIcon, CheckIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon, InformationCircleIcon, ExclamationTriangleIcon, ArrowUpRightIcon} from '@heroicons/react/24/outline';
const icons = {list:QueueListIcon,settings:AdjustmentsHorizontalIcon,shop:ShoppingBagIcon,plus:PlusIcon,minus:MinusIcon,check:CheckIcon,arrow:ChevronRightIcon,down:ChevronDownIcon,up:ChevronUpIcon,clock:ClockIcon,search:MagnifyingGlassIcon,cross:XMarkIcon,retry:ArrowPathIcon,info:InformationCircleIcon,warning:ExclamationTriangleIcon,external:ArrowUpRightIcon};
export function Icon({name='plus',size=22,className,stroke=1.7}:{name?:string;size?:number;className?:string;stroke?:number}) {
 if(name==='meals')return <span className={className}><Plate size={size} stroke={stroke}/></span>;
 const Glyph=icons[name as keyof typeof icons]??InformationCircleIcon;
 return <Glyph width={size} height={size} strokeWidth={stroke} className={className} aria-hidden="true" focusable="false"/>;
}

/**
 * A dinner plate, seen from above: rim, and food on it.
 *
 * The tab said "Meals" beside a grid of squares, which is what the screen
 * looks like rather than what it is for. Heroicons has no plate, so this one
 * is drawn here to sit at the same weight as the rest.
 */
function Plate({size, stroke}: {size: number; stroke: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6.2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M2.6 3.4v3.2a1.9 1.9 0 0 0 1.9 1.9 1.9 1.9 0 0 0 1.9-1.9V3.4M4.5 8.5v12.1" />
      <path d="M21.4 3.4c-1.3 0-2.3 1.5-2.3 3.4 0 1.4.6 2.5 1.5 2.9v10.8" />
    </svg>
  );
}
