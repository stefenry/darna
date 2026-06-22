'use client';

// Story 7.3 — recharge la page courante (utile dès que le réseau revient).
// Volontairement minimal : pas d'animation (reduced-motion safe), cible ≥ 48px.
export function OfflineRetry({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="min-h-touch rounded-[14px] bg-accent-500 px-6 text-base font-medium text-white hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
    >
      {label}
    </button>
  );
}
