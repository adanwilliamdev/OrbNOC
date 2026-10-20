export const pct = (v: number | null): string => (v === null ? '—' : `${v.toFixed(v === 100 ? 0 : 2)}%`);
