/**
 * The app's icons, drawn rather than typed.
 *
 * Emoji were standing in for icons: they render differently on every device,
 * cannot take the interface's colour, and are the single loudest signal that
 * something was thrown together. These are one family — 24px grid, round
 * caps, 1.8 stroke — so they sit together and inherit `currentColor`.
 */
interface Props {
  size?: number;
  stroke?: number;
  className?: string;
}

function Svg({ size = 22, stroke = 1.8, className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  meals: (p: Props) => (
    <Svg {...p}>
      <path d="M6 3v8a2 2 0 0 0 4 0V3" />
      <path d="M8 11v10" />
      <path d="M17 3c-1.5 1.5-2 3.5-2 5.5S15.5 12 17 12h1V3z" />
      <path d="M17.5 12v9" />
    </Svg>
  ),
  list: (p: Props) => (
    <Svg {...p}>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6l1 1 2-2" />
      <path d="M4 12l1 1 2-2" />
      <circle cx="5" cy="18" r="1" />
    </Svg>
  ),
  basket: (p: Props) => (
    <Svg {...p}>
      <path d="M4 7h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5z" />
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
    </Svg>
  ),
  plus: (p: Props) => (
    <Svg stroke={2} {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  minus: (p: Props) => (
    <Svg stroke={2} {...p}>
      <path d="M5 12h14" />
    </Svg>
  ),
  check: (p: Props) => (
    <Svg stroke={2.4} {...p}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  ),
  cross: (p: Props) => (
    <Svg stroke={2} {...p}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </Svg>
  ),
  down: (p: Props) => (
    <Svg {...p}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  up: (p: Props) => (
    <Svg {...p}>
      <path d="M18 15l-6-6-6 6" />
    </Svg>
  ),
  right: (p: Props) => (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  search: (p: Props) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  ),
  warning: (p: Props) => (
    <Svg {...p}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </Svg>
  ),
  info: (p: Props) => (
    <Svg stroke={1.7} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </Svg>
  ),
  retry: (p: Props) => (
    <Svg stroke={1.9} {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  ),
  external: (p: Props) => (
    <Svg stroke={2} {...p}>
      <path d="M7 17L17 7" />
      <path d="M9 7h8v8" />
    </Svg>
  ),
};
