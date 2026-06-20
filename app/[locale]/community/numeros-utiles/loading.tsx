// Story 3.3 (AC5) — skeleton catégories (motion-safe, jamais spinner).
export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="h-8 w-48 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      {[0, 1].map((cat) => (
        <div key={cat} className="flex flex-col gap-2">
          <div className="h-5 w-24 motion-safe:animate-pulse rounded bg-bg-soft" />
          {[0, 1].map((i) => (
            <div key={i} className="h-20 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
          ))}
        </div>
      ))}
    </section>
  );
}
