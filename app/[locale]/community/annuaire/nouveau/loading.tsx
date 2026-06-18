// Story 2.4 (AC6) — skeleton formulaire, jamais de spinner.
export default function Loading() {
  return (
    <section className="flex flex-col gap-5">
      <div className="h-8 w-48 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      ))}
      <div className="h-14 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
    </section>
  );
}
