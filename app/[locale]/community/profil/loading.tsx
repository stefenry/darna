// AR21 — skeleton, jamais de spinner.
export default function Loading() {
  return (
    <section className="flex flex-col gap-8">
      <div className="h-8 w-40 animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-[14px] bg-bg-soft" />
        ))}
      </div>
    </section>
  );
}
