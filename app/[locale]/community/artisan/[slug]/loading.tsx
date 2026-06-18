// Story 2.3 (AC7) — skeleton fiche, jamais de spinner (motion-safe).
// Inclut section avis (review 2026-06-17 P13) pour limiter le CLS au remplacement.
export default function Loading() {
  return (
    <section className="flex flex-col gap-6 pb-32">
      <div className="h-8 w-2/3 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 w-20 motion-safe:animate-pulse rounded-full bg-bg-soft" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-6 w-32 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        {[0, 1].map((i) => (
          <div key={i} className="h-24 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
      <div className="h-14 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
    </section>
  );
}
