export function Icon({ name }: { name: string }) {
  const paths: Record<string,string> = { plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',meals:'M5 3v7m4-7v7M3 3v5a4 4 0 0 0 8 0V3M7 12v9M18 3c-4 4-4 9 0 9h2M20 3v18',list:'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',shop:'M3 8h18l-2 12H5L3 8Zm5 0 4-6 4 6',arrow:'m9 5 7 7-7 7',clock:'M12 7v5l3 2',search:'m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'};
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name==='clock'&&<circle cx="12" cy="12" r="9"/>}<path d={paths[name] || paths.plus}/></svg>;
}
