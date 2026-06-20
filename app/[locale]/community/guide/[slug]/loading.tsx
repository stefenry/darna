// Story 3.2 (AC7) — skeleton entrée Guide (motion-safe, jamais spinner).
export default function Loading() {
  return (
    <article className="flex flex-col gap-5">
      <div className="size-10 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-4 w-40 motion-safe:animate-pulse rounded bg-bg-soft" />
      <div className="h-7 w-3/4 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full motion-safe:animate-pulse rounded bg-bg-soft" />
        ))}
      </div>
    </article>
  );
}
