import type { CSSProperties } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Atraso escalonado da animação `.reveal` (entrada do painel). */
export const stagger = (index: number): CSSProperties => ({ '--i': index }) as CSSProperties;
