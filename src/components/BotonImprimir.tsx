'use client';

export function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="btn-marca px-4 py-2 text-sm">
      Imprimir
    </button>
  );
}
