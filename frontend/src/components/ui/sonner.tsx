'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      richColors
      closeButton
      toastOptions={{ classNames: { toast: 'border border-slate-600/70' } }}
      {...props}
    />
  );
}

export { Toaster };
