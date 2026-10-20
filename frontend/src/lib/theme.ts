// Cores para o que o CSS não alcança (atributos SVG e estilos inline do Recharts / React Flow).
// São referências às variáveis de globals.css: trocar a paleta lá troca os gráficos também.

export const chart = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  idle: 'var(--subtle)',
  /** Séries temporais (sinal): o amarelo da marca. */
  signal: 'var(--primary)',
  grid: 'var(--border)',
  axis: 'var(--subtle)',
  label: 'var(--muted-foreground)',
} as const;

export const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--foreground)',
  fontSize: '12px',
  boxShadow: '0 12px 32px -10px rgb(0 0 0 / 0.6)',
} as const;

export const tooltipLabelStyle = { color: 'var(--muted-foreground)', fontSize: '11px' } as const;
