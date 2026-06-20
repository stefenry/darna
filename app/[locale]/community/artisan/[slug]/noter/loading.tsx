// Story 2.6 (AC7) — skeleton page notation, jamais de spinner (motion-safe).
export default function Loading() {
  return (
    <section className="flex flex-col gap-6 pb-32">
      <div className="h-8 w-1/2 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-12 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
      <div className="h-28 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-14 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
    </section>
  );
}
