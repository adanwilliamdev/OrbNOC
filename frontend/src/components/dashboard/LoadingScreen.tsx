import BrandMark from '@/components/layout/BrandMark';

export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <BrandMark size="lg" />
      <div className="h-0.5 w-24 overflow-hidden rounded-full bg-muted" role="status" aria-label="Carregando">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="text-xs text-subtle">Inicializando...</p>
    </div>
  );
}
