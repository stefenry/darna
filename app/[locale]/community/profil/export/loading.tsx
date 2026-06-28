// Story 8.3 (AR21) — skeleton, jamais de spinner.
export default function Loading() {
  return (
    <section className="flex flex-col gap-6">
      <div className="h-8 w-48 animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-40 animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="h-12 w-44 animate-pulse rounded-[14px] bg-bg-soft" />
    </section>
  );
}
