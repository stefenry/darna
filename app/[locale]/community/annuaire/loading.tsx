// Story 2.2 (AC7) — skeleton 5 cartes, jamais de spinner (AR21, règle Aïcha).
// Review F9 : `animate-pulse` doit être gated par `motion-safe:` pour respecter
// `prefers-reduced-motion` (AC7).
export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="h-8 w-48 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-12 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-36 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
    </section>
  );
}
