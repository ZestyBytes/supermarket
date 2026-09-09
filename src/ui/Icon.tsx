import {Squares2X2Icon, QueueListIcon, AdjustmentsHorizontalIcon, ShoppingBagIcon, PlusIcon, MinusIcon, CheckIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon, InformationCircleIcon, ExclamationTriangleIcon, ArrowUpRightIcon} from '@heroicons/react/24/outline';
const icons = {meals:Squares2X2Icon,list:QueueListIcon,settings:AdjustmentsHorizontalIcon,shop:ShoppingBagIcon,plus:PlusIcon,minus:MinusIcon,check:CheckIcon,arrow:ChevronRightIcon,down:ChevronDownIcon,up:ChevronUpIcon,clock:ClockIcon,search:MagnifyingGlassIcon,cross:XMarkIcon,retry:ArrowPathIcon,info:InformationCircleIcon,warning:ExclamationTriangleIcon,external:ArrowUpRightIcon};
export function Icon({name='plus',size=22,className,stroke=1.7}:{name?:string;size?:number;className?:string;stroke?:number}) {
 const Glyph=icons[name as keyof typeof icons]??InformationCircleIcon;
 return <Glyph width={size} height={size} strokeWidth={stroke} className={className} aria-hidden="true" focusable="false"/>;
}
