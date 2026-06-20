// Story 3.2 (AC7) — skeleton thèmes (jamais spinner, AR21 ; motion-safe).
export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="h-8 w-48 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-12 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
    </section>
  );
}
