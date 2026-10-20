'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Cores dos toasts vêm dos tokens (variáveis documentadas do Sonner), não do tema "rico" padrão.
const tint = (token: string) => `color-mix(in oklab, var(--${token}) 14%, var(--popover))`;
const edge = (token: string) => `color-mix(in oklab, var(--${token}) 35%, var(--border))`;

const style = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--foreground)',
  '--normal-border': 'var(--border)',
  '--success-bg': tint('ok'),
  '--success-text': 'var(--ok)',
  '--success-border': edge('ok'),
  '--error-bg': tint('bad'),
  '--error-text': 'var(--bad)',
  '--error-border': edge('bad'),
  '--warning-bg': tint('warn'),
  '--warning-text': 'var(--warn)',
  '--warning-border': edge('warn'),
  '--info-bg': 'var(--popover)',
  '--info-text': 'var(--foreground)',
  '--info-border': 'var(--border)',
  '--border-radius': '12px',
} as CSSProperties;

function Toaster(props: ToasterProps) {
  return <Sonner theme="dark" position="top-right" richColors closeButton style={style} {...props} />;
}

export { Toaster };
