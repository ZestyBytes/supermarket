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

const glyphs: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  check: "m5 12 4 4L19 6",
  meals: "M5 3v7m4-7v7M3 3v5a4 4 0 0 0 8 0V3M7 12v9M18 3c-4 4-4 9 0 9h2M20 3v18",
  list: "M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1",
  shop: "M3 8h18l-2 12H5L3 8Zm5 0 4-6 4 6",
  arrow: "m9 5 7 7-7 7",
  clock: "M12 7v5l3 2",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  // An unknown name silently draws a plus, so anything used anywhere in the
  // app has to be here: a "Retry" button with a + on it is how that shows up.
  down: "m6 9 6 6 6-6",
  up: "m18 15-6-6-6 6",
  cross: "M18 6 6 18M6 6l12 12",
  retry: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  info: "M12 12v5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  warning: "M12 9v4M12 17h.01M10.3 3.9 2.4 17.6a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
};

function IconGlyph({ name, ...props }: Props & { name?: string }) {
  const stroke = props.stroke ?? 1.8;
  const d = glyphs[name ?? "plus"] ?? glyphs.plus;

  if (name === "clock") {
    return (
      <Svg {...props} stroke={stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </Svg>
    );
  }

  if (name === "search") {
    return (
      <Svg {...props} stroke={stroke}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </Svg>
    );
  }

  return (
    <Svg {...props} stroke={stroke}>
      <path d={d} />
    </Svg>
  );
}

export const Icon = Object.assign(IconGlyph, {
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
});

