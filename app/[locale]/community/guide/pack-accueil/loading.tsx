// Story 3.4 (AC5) — skeleton Pack (motion-safe, jamais spinner).
export default function Loading() {
  return (
    <article className="flex flex-col gap-5">
      <div className="size-10 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-8 w-44 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
    </article>
  );
}
